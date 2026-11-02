import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout } from "node:timers/promises";

// Exercise the built Worker, since a successful bundle does not prove that
// Next.js can load its manifests inside the Workers runtime.
const port = 8789;
const worker = spawn(process.execPath, [
  "node_modules/wrangler/bin/wrangler.js",
  "dev", "--local", "--ip", "127.0.0.1", "--port", String(port),
], { stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
let spawnError;
worker.on("error", (error) => { spawnError = error; });
worker.stdout.on("data", (chunk) => { logs += chunk; });
worker.stderr.on("data", (chunk) => { logs += chunk; });

try {
  const deadline = Date.now() + 60_000;
  while (!logs.includes("Ready on")) {
    if (spawnError) throw spawnError;
    assert.equal(worker.exitCode, null, `Worker exited early:\n${logs}`);
    assert.ok(Date.now() < deadline, `Worker did not become ready:\n${logs}`);
    await setTimeout(200);
  }

  // This only renders the event shell; data loading happens in the browser.
  for (const path of ["/", "/terms", "/privacy", "/e/00000000-0000-4000-8000-000000000000"]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
    assert.match(await response.text(), /AkiMatch/i, `${path} is missing app content`);
    console.log(`Worker smoke check passed: ${path}`);
  }
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  if (worker.pid && worker.exitCode === null && worker.signalCode === null) {
    const closed = once(worker, "close");
    const forceKill = globalThis.setTimeout(() => worker.kill("SIGKILL"), 5_000);
    forceKill.unref();
    worker.kill("SIGTERM");
    await closed;
    clearTimeout(forceKill);
  }
}
