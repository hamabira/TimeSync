import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PLACEHOLDER = "__PWA_CACHE_VERSION__";

export function createPwaCacheVersion(buildId, workerSource, offlineSource) {
  const normalizedBuildId = buildId.trim();
  if (!normalizedBuildId || !/^[A-Za-z0-9._-]+$/.test(normalizedBuildId)) {
    throw new Error("The Next.js build ID must be a non-empty URL-safe string.");
  }

  const sourceHash = createHash("sha256")
    .update(workerSource)
    .update("\0")
    .update(offlineSource)
    .digest("hex")
    .slice(0, 16);
  return `${normalizedBuildId}-${sourceHash}`;
}

export function renderServiceWorker({ buildId, workerSource, offlineSource }) {
  const placeholderCount = workerSource.split(PLACEHOLDER).length - 1;
  if (placeholderCount !== 1) {
    throw new Error(`Expected one ${PLACEHOLDER} placeholder in the service worker source.`);
  }
  const version = createPwaCacheVersion(buildId, workerSource, offlineSource);
  return {
    version,
    source: workerSource.replace(PLACEHOLDER, version),
  };
}

export function generateServiceWorker(projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")) {
  const buildIdPath = resolve(projectRoot, ".next/BUILD_ID");
  if (!existsSync(buildIdPath)) {
    throw new Error("A Next.js build is required before generating public/sw.js (.next/BUILD_ID is missing).");
  }

  const buildId = readFileSync(buildIdPath, "utf8");
  const workerSource = readFileSync(resolve(projectRoot, "src/pwa/service-worker.js"), "utf8");
  const offlineSource = readFileSync(resolve(projectRoot, "public/offline.html"), "utf8");
  const rendered = renderServiceWorker({ buildId, workerSource, offlineSource });
  const outputPath = resolve(projectRoot, "public/sw.js");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered.source);
  return { outputPath, version: rendered.version };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const generated = generateServiceWorker();
  process.stdout.write(`Generated ${generated.outputPath} (${generated.version})\n`);
}
