import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { INSTALL_CAPTURE_SCRIPT } from "../src/lib/pwa-install-capture.ts";

test("an install event arriving before hydration is retained without opening a prompt", () => {
  const window = new EventTarget();
  const context = vm.createContext({ window });
  vm.runInContext(INSTALL_CAPTURE_SCRIPT, context);
  const event = new Event("beforeinstallprompt", { cancelable: true });
  let prompts = 0;
  event.prompt = () => { prompts++; };
  window.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(window.__akimatchInstallCapture.prompt, event);
  assert.equal(prompts, 0);
  // Re-evaluating a root script must not discard the one-use event or add listeners.
  vm.runInContext(INSTALL_CAPTURE_SCRIPT, context);
  assert.equal(window.__akimatchInstallCapture.prompt, event);
  window.dispatchEvent(new Event("appinstalled"));
  assert.equal(window.__akimatchInstallCapture.prompt, null);
  assert.equal(window.__akimatchInstallCapture.installed, true);
  const next = new Event("beforeinstallprompt", { cancelable: true });
  window.dispatchEvent(next);
  assert.equal(window.__akimatchInstallCapture.installed, false);
  assert.equal(window.__akimatchInstallCapture.prompt, next);
});
