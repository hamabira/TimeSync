/* global self, caches, fetch */

const CACHE_PREFIX = "akimatch-static-";
const CACHE_NAME = `${CACHE_PREFIX}__PWA_CACHE_VERSION__`;
const STATIC_PATHS = ["/offline.html", "/brand/icon-192.png", "/brand/icon-512.png"];
const STATIC_PATH_SET = new Set(STATIC_PATHS);
const FALLBACK_HTML = `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#2563eb">
<title>接続できません · AkiMatch</title>
<style>body{margin:0;background:#f8fafc;color:#172033;font:16px/1.7 system-ui,sans-serif}main{max-width:36rem;margin:12vh auto;padding:2rem}h1{font-size:1.6rem}p{color:#475569}button{min-height:48px;border:0;border-radius:10px;background:#1d4ed8;color:#fff;padding:0 1.25rem;font:inherit;font-weight:700;cursor:pointer}@media(max-width:40rem){main{margin:8vh 0;padding:1.25rem}}</style>
<main><h1>いまは接続できません</h1><p>回答の保存にはインターネット接続が必要です。接続を確認してから再読み込みしてください。</p><button type="button" onclick="location.reload()">再読み込み</button></main>
</html>`;

function staticURL(path) {
  return new URL(path, self.location.origin).href;
}

async function precacheStaticAssets() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    STATIC_PATHS.map(async (path) => {
      const url = staticURL(path);
      const response = await fetch(new Request(url, { cache: "reload" }));
      if (!response.ok) {
        throw new Error(`Static PWA asset returned ${response.status}: ${path}`);
      }
      // Cloudflare may canonicalize offline.html to /offline. Store a synthetic
      // response so a followed asset redirect never becomes a navigation redirect.
      await cache.put(url, new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }));
    })
  );
}

async function activateCurrentWorker() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name))
  );
  await self.clients.claim();
}

async function offlineDocument() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(staticURL("/offline.html"));
    if (cached) return cached;
  } catch {
    // Continue with a small inline fallback if the cache was removed or unavailable.
  }

  return new Response(FALLBACK_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function staticAsset(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request.url);
    if (cached) return cached;
  } catch {
    // Storage failure must not break a public asset that is available over the network.
  }
  return fetch(request);
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheStaticAssets());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(activateCurrentWorker());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== "GET") return;
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        // Returning a document response leaves the browser at the original navigation URL.
        return offlineDocument();
      })
    );
    return;
  }

  if (url.search === "" && STATIC_PATH_SET.has(url.pathname)) {
    event.respondWith(staticAsset(request));
  }
});
