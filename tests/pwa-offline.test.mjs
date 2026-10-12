import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { renderServiceWorker, createPwaCacheVersion } from "../scripts/generate-service-worker.mjs";

const origin = "https://akimatch.example";
const workerTemplate = readFileSync(new URL("../src/pwa/service-worker.js", import.meta.url), "utf8");
const offlineSource = readFileSync(new URL("../public/offline.html", import.meta.url), "utf8");

class FakeEvents {
  listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

function createWorkerRuntime(fetchImpl = async () => new Response("asset")) {
  const self = new FakeEvents();
  const cachesByName = new Map();
  const writes = [];
  let skipWaitingCalls = 0;
  let claimCalls = 0;
  self.location = { origin };
  self.clients = { claim: async () => { claimCalls++; } };
  self.skipWaiting = () => { skipWaitingCalls++; };

  const caches = {
    async open(name) {
      const entries = cachesByName.get(name) ?? new Map();
      cachesByName.set(name, entries);
      return {
        async put(key, response) {
          const cacheKey = typeof key === "string" ? key : key.url;
          entries.set(cacheKey, response);
          writes.push({ name, key: cacheKey });
        },
        async match(key) {
          const cacheKey = typeof key === "string" ? key : key.url;
          return entries.get(cacheKey) ?? null;
        },
      };
    },
    async keys() {
      return [...cachesByName.keys()];
    },
    async delete(name) {
      return cachesByName.delete(name);
    },
  };

  const { source, version } = renderServiceWorker({
    buildId: "test-build",
    workerSource: workerTemplate,
    offlineSource,
  });
  runInNewContext(source, {
    self,
    caches,
    fetch: fetchImpl,
    URL,
    Request,
    Response,
    Set,
  });

  return {
    self,
    cachesByName,
    caches,
    writes,
    version,
    get skipWaitingCalls() { return skipWaitingCalls; },
    get claimCalls() { return claimCalls; },
  };
}

function dispatchFetch(runtime, request) {
  request.headers ??= new Headers();
  let responsePromise;
  runtime.self.dispatch("fetch", {
    request,
    respondWith(promise) {
      responsePromise = Promise.resolve(promise);
    },
  });
  return responsePromise;
}

test("the service worker precaches only the offline document and two PWA icons with reload requests", async () => {
  const fetchCalls = [];
  const runtime = createWorkerRuntime(async (request) => {
    fetchCalls.push(request);
    return new Response(`cached:${new URL(request.url).pathname}`, { status: 200 });
  });
  let installation;
  runtime.self.dispatch("install", { waitUntil(promise) { installation = promise; } });
  await installation;

  assert.deepEqual(
    fetchCalls.map((request) => [new URL(request.url).pathname, request.cache]).sort(),
    [
      ["/brand/icon-192.png", "reload"],
      ["/brand/icon-512.png", "reload"],
      ["/offline.html", "reload"],
    ].sort()
  );
  assert.deepEqual(
    runtime.writes.map(({ key }) => new URL(key).pathname).sort(),
    ["/brand/icon-192.png", "/brand/icon-512.png", "/offline.html"].sort()
  );
  assert.ok(runtime.writes.every(({ name }) => name === `akimatch-static-${runtime.version}`));
});

test("the worker ignores event pages, APIs, RSC and POST requests without caching them", () => {
  const runtime = createWorkerRuntime();
  const requests = [
    { url: `${origin}/e/a1b2c3`, method: "GET", mode: "cors" },
    { url: `${origin}/api/events`, method: "GET", mode: "cors" },
    { url: `${origin}/e/a1b2c3?_rsc=abc`, method: "GET", mode: "cors" },
    { url: `${origin}/offline.html`, method: "GET", mode: "cors", headers: new Headers({ RSC: "1" }) },
    { url: `${origin}/offline.html?_rsc=abc`, method: "GET", mode: "cors" },
    { url: `${origin}/e/a1b2c3`, method: "POST", mode: "cors" },
    { url: `${origin}/actions`, method: "POST", mode: "cors" },
  ];
  for (const request of requests) {
    assert.equal(dispatchFetch(runtime, request), undefined);
  }
  assert.deepEqual(runtime.writes, []);
});

test("navigation fetch passes the original request and preserves HTTP error responses", async () => {
  const errorResponse = new Response("server error", { status: 503 });
  const calls = [];
  const runtime = createWorkerRuntime(async (request) => {
    calls.push(request);
    return errorResponse;
  });
  const request = { url: `${origin}/e/event-id?view=results`, method: "GET", mode: "navigate" };
  const response = await dispatchFetch(runtime, request);

  assert.equal(calls[0], request);
  assert.equal(response, errorResponse);
  assert.equal(response.status, 503);
  assert.deepEqual(runtime.writes, []);
});

test("only a rejected navigation serves the cached offline document, without changing its URL", async () => {
  const runtime = createWorkerRuntime(async (request) => {
    if (request.mode === "navigate") throw new TypeError("offline");
    return new Response(offlineSource, { status: 200 });
  });
  let installation;
  runtime.self.dispatch("install", { waitUntil(promise) { installation = promise; } });
  await installation;
  const request = { url: `${origin}/e/secret-event?tab=answer`, method: "GET", mode: "navigate" };
  const response = await dispatchFetch(runtime, request);

  assert.equal(response.status, 200);
  const body = await response.text();
  assert.match(body, /いまは接続できません/);
  assert.match(body, /回答の保存にはインターネット接続が必要です/);
  assert.equal(request.url, `${origin}/e/secret-event?tab=answer`);
  assert.deepEqual(runtime.writes.map(({ key }) => new URL(key).pathname).sort(), [
    "/brand/icon-192.png",
    "/brand/icon-512.png",
    "/offline.html",
  ].sort());
});

test("a missing offline cache returns a small inline Japanese retry page", async () => {
  const runtime = createWorkerRuntime(async () => { throw new TypeError("offline"); });
  const request = { url: `${origin}/e/event-id`, method: "GET", mode: "navigate" };
  const response = await dispatchFetch(runtime, request);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/html/);
  const body = await response.text();
  assert.match(body, /いまは接続できません/);
  assert.match(body, /再読み込み/);
  assert.deepEqual(runtime.writes, []);
});

test("the only service-worker lifecycle message that skips waiting is SKIP_WAITING", () => {
  const runtime = createWorkerRuntime();
  runtime.self.dispatch("message", { data: { type: "OTHER" } });
  assert.equal(runtime.skipWaitingCalls, 0);
  runtime.self.dispatch("message", { data: { type: "SKIP_WAITING" } });
  assert.equal(runtime.skipWaitingCalls, 1);
});

test("activation removes only old AkiMatch static caches and claims clients", async () => {
  const runtime = createWorkerRuntime();
  const currentName = `akimatch-static-${runtime.version}`;
  runtime.cachesByName.set(currentName, new Map());
  runtime.cachesByName.set("akimatch-static-old-build", new Map());
  runtime.cachesByName.set("other-app-cache", new Map());
  let activation;
  runtime.self.dispatch("activate", { waitUntil(promise) { activation = promise; } });
  await activation;

  assert.deepEqual([...runtime.cachesByName.keys()], [currentName, "other-app-cache"]);
  assert.equal(runtime.claimCalls, 1);
});

test("cache version is deterministic for one build and changes with the Next build ID or source", () => {
  const version = createPwaCacheVersion("build-1", workerTemplate, offlineSource);
  assert.equal(version, createPwaCacheVersion("build-1", workerTemplate, offlineSource));
  assert.notEqual(version, createPwaCacheVersion("build-2", workerTemplate, offlineSource));
  assert.notEqual(version, createPwaCacheVersion("build-1", `${workerTemplate}\n`, offlineSource));
  assert.notEqual(version, createPwaCacheVersion("build-1", workerTemplate, `${offlineSource}\n`));
});


test("storage failure retains network access for public assets and gives an inline navigation fallback", async () => {
  const runtime = createWorkerRuntime(async (request) => {
    if (request.mode === "navigate") throw new TypeError("offline");
    return new Response("network icon");
  });
  runtime.caches.open = async () => { throw new Error("storage unavailable"); };
  const icon = await dispatchFetch(runtime, { url: `${origin}/brand/icon-192.png`, method: "GET", mode: "cors" });
  assert.equal(await icon.text(), "network icon");
  const page = await dispatchFetch(runtime, { url: `${origin}/e/event-id`, method: "GET", mode: "navigate" });
  assert.match(await page.text(), /いまは接続できません/);
});

test("a failed static response prevents a worker from finishing installation", async () => {
  const runtime = createWorkerRuntime(async () => new Response("missing asset", { status: 404 }));
  let installation;
  runtime.self.dispatch("install", { waitUntil(promise) { installation = promise; } });
  await assert.rejects(installation, /Static PWA asset returned 404/);
  assert.equal(runtime.skipWaitingCalls, 0);
});


test("a redirected offline asset is stored as a synthetic response for original-URL navigation", async () => {
  const runtime = createWorkerRuntime(async (request) => {
    if (request.mode === "navigate") throw new TypeError("offline");
    const fetched = new Response(offlineSource);
    Object.defineProperty(fetched, "redirected", { value: true });
    Object.defineProperty(fetched, "url", { value: `${origin}/offline` });
    return fetched;
  });
  let installation;
  runtime.self.dispatch("install", { waitUntil(promise) { installation = promise; } });
  await installation;
  const response = await dispatchFetch(runtime, { url: `${origin}/e/event-id`, method: "GET", mode: "navigate" });
  assert.equal(response.redirected, false);
  assert.equal(response.url, "");
  assert.match(await response.text(), /いまは接続できません/);
});
