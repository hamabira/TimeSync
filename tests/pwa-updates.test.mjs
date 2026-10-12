import assert from "node:assert/strict";
import test from "node:test";
import { PwaUpdateController } from "../src/lib/pwa-updates.ts";

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

  dispatch(type) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(new Event(type));
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeWorker extends FakeEvents {
  state = "installing";
  messages = [];

  postMessage(message) {
    this.messages.push(message);
  }
}

class FakeRegistration extends FakeEvents {
  waiting = null;
  installing = null;
  updateCalls = 0;

  async update() {
    this.updateCalls += 1;
  }
}

class FakeServiceWorkerContainer extends FakeEvents {
  controller = null;
  registration = new FakeRegistration();
  registerCalls = [];

  async register(scriptURL, options) {
    this.registerCalls.push({ scriptURL, options });
    return this.registration;
  }
}

function createController({ canReload = () => true } = {}) {
  const serviceWorker = new FakeServiceWorkerContainer();
  const states = [];
  let reloadCalls = 0;
  const controller = new PwaUpdateController({
    serviceWorker,
    canReload,
    reload: () => { reloadCalls += 1; },
    onStateChange: (state) => states.push(state),
  });
  return {
    controller,
    serviceWorker,
    states,
    get reloadCalls() { return reloadCalls; },
  };
}

async function startController(options) {
  const setup = createController(options);
  await setup.controller.start();
  return setup;
}

function installWaitingUpdate(setup) {
  setup.serviceWorker.controller = new FakeWorker();
  const worker = new FakeWorker();
  worker.state = "installed";
  setup.serviceWorker.registration.installing = worker;
  setup.serviceWorker.registration.waiting = worker;
  setup.serviceWorker.registration.dispatch("updatefound");
  worker.dispatch("statechange");
  return worker;
}

test("registration uses root scope without cached worker scripts and checks once at startup", async () => {
  const setup = await startController();
  assert.deepEqual(setup.serviceWorker.registerCalls, [
    { scriptURL: "/sw.js", options: { scope: "/", updateViaCache: "none" } },
  ]);
  assert.equal(setup.serviceWorker.registration.updateCalls, 1);
  setup.controller.stop();
});

test("a first installation does not show an update notice", async () => {
  const setup = await startController();
  const worker = new FakeWorker();
  worker.state = "installed";
  setup.serviceWorker.registration.installing = worker;
  setup.serviceWorker.registration.dispatch("updatefound");
  worker.dispatch("statechange");

  assert.equal(setup.controller.currentState, "hidden");
  assert.deepEqual(setup.states, []);
  setup.controller.stop();
});

test("a waiting worker is explicit and dirty or busy forms block activation", async (t) => {
  for (const blockedBy of ["dirty", "busy"]) {
    await t.test(blockedBy, async () => {
      let canReload = true;
      const setup = await startController({ canReload: () => canReload });
      const worker = installWaitingUpdate(setup);
      assert.equal(setup.controller.currentState, "waiting");

      canReload = false;
      assert.equal(setup.controller.activateOrReload(), false);
      assert.deepEqual(worker.messages, []);
      assert.equal(setup.reloadCalls, 0);
      setup.controller.stop();
    });
  }
});

test("an explicit clean update waits for controllerchange before reloading", async () => {
  const setup = await startController();
  const worker = installWaitingUpdate(setup);
  assert.equal(setup.controller.activateOrReload(), true);
  assert.equal(setup.controller.currentState, "activating");
  assert.deepEqual(worker.messages, [{ type: "SKIP_WAITING" }]);
  assert.equal(setup.reloadCalls, 0);

  setup.serviceWorker.controller = new FakeWorker();
  setup.serviceWorker.registration.waiting = null;
  setup.serviceWorker.dispatch("controllerchange");

  assert.equal(setup.controller.currentState, "hidden");
  assert.equal(setup.reloadCalls, 1);
  setup.controller.stop();
});

test("a draft created during activation is retained until the user explicitly reloads", async () => {
  let canReload = true;
  const setup = await startController({ canReload: () => canReload });
  const worker = installWaitingUpdate(setup);
  assert.equal(setup.controller.activateOrReload(), true);

  canReload = false;
  setup.serviceWorker.controller = new FakeWorker();
  setup.serviceWorker.registration.waiting = null;
  setup.serviceWorker.dispatch("controllerchange");

  assert.equal(setup.controller.currentState, "reload-needed");
  assert.equal(setup.reloadCalls, 0);
  assert.equal(setup.controller.activateOrReload(), false);
  canReload = true;
  assert.equal(setup.controller.activateOrReload(), true);
  assert.equal(setup.reloadCalls, 1);
  assert.deepEqual(worker.messages, [{ type: "SKIP_WAITING" }]);
  setup.controller.stop();
});

test("activation from another tab keeps a manual reload notice but never reloads this tab", async () => {
  const setup = createController();
  setup.serviceWorker.controller = new FakeWorker();
  await setup.controller.start();
  const worker = installWaitingUpdate(setup);
  setup.serviceWorker.registration.waiting = null;
  worker.state = "activating";
  worker.dispatch("statechange");
  worker.state = "activated";
  setup.serviceWorker.controller = worker;
  setup.serviceWorker.dispatch("controllerchange");

  assert.equal(setup.controller.currentState, "reload-needed");
  assert.equal(setup.reloadCalls, 0);
  assert.deepEqual(worker.messages, []);
  setup.controller.stop();
});

test("stop removes controller, registration, and installing-worker listeners", async () => {
  const setup = await startController();
  const worker = new FakeWorker();
  setup.serviceWorker.registration.installing = worker;
  setup.serviceWorker.registration.dispatch("updatefound");
  assert.equal(setup.serviceWorker.listenerCount("controllerchange"), 1);
  assert.equal(setup.serviceWorker.registration.listenerCount("updatefound"), 1);
  assert.equal(worker.listenerCount("statechange"), 1);

  setup.controller.stop();
  assert.equal(setup.serviceWorker.listenerCount("controllerchange"), 0);
  assert.equal(setup.serviceWorker.registration.listenerCount("updatefound"), 0);
  assert.equal(worker.listenerCount("statechange"), 0);
});


test("an update already waiting at startup is observed and can be retired without reloading", async () => {
  const setup = createController();
  setup.serviceWorker.controller = new FakeWorker();
  const waiting = new FakeWorker();
  waiting.state = "installed";
  setup.serviceWorker.registration.waiting = waiting;
  await setup.controller.start();
  assert.equal(setup.controller.currentState, "waiting");
  waiting.state = "redundant";
  setup.serviceWorker.registration.waiting = null;
  waiting.dispatch("statechange");
  assert.equal(setup.controller.currentState, "hidden");
  assert.equal(setup.reloadCalls, 0);
  setup.controller.stop();
});

test("a pending update check cannot publish new state after the controller stops", async () => {
  const setup = await startController();
  let resolveUpdate;
  setup.serviceWorker.registration.update = () => new Promise(resolve => { resolveUpdate = resolve; });
  const pending = setup.controller.checkForUpdate();
  setup.controller.stop();
  setup.serviceWorker.controller = new FakeWorker();
  const waiting = new FakeWorker();
  waiting.state = "installed";
  setup.serviceWorker.registration.waiting = waiting;
  resolveUpdate();
  await pending;
  assert.deepEqual(setup.states, []);
  assert.equal(setup.controller.activateOrReload(), false);
});
