#!/usr/bin/env node
/**
 * Script de build para Cloudflare Pages
 *
 * Estratégia:
 * 1. Roda o OpenNext build (cria .open-next/worker.js + assets estáticos)
 * 2. Usa esbuild com --platform=node para bundlar TUDO em um ÚNICO _worker.js
 * 3. Módulos Node.js (fs, path, crypto, etc.) ficam como require() e são
 *    resolvidos em runtime pelo nodejs_compat do Cloudflare
 * 4. cloudflare:* imports são external (APIs nativas do Cloudflare)
 * 5. O diretório .open-next/assets/ fica limpo: só arquivos estáticos + _worker.js
 *    (sem node_modules, sem symlinks — evita o erro de "links to files that can't be accessed")
 */

import { execSync } from "child_process";
import { existsSync, statSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const OPEN_NEXT_DIR = join(ROOT, ".open-next");
const ASSETS_DIR = join(OPEN_NEXT_DIR, "assets");
const WORKER_ENTRY = join(OPEN_NEXT_DIR, "worker.js");
const OUTPUT_WORKER = join(ASSETS_DIR, "_worker.js");

console.log("🔨 Cloudflare Pages Build");
console.log("=========================\n");

// Step 1: OpenNext build
console.log("📦 Step 1: Running OpenNext build for Cloudflare...");
try {
  execSync("npx @opennextjs/cloudflare build", {
    cwd: ROOT,
    stdio: "inherit",
  });
} catch (e) {
  console.error("❌ OpenNext build failed!");
  process.exit(1);
}

// Step 2: Verify build output
if (!existsSync(WORKER_ENTRY)) {
  console.error("❌ worker.js not found in .open-next/ directory!");
  process.exit(1);
}

if (!existsSync(ASSETS_DIR)) {
  console.error("❌ Assets directory not found in .open-next/assets/!");
  process.exit(1);
}

// Step 3: Bundle into a single _worker.js using esbuild
//
// --platform=node: Node.js built-ins (fs, path, crypto, async_hooks, etc.)
//   são automaticamente tratados como external e ficam como require() calls.
//   O Cloudflare Workers com nodejs_compat resolve esses requires em runtime.
//
// --external:cloudflare:*: APIs nativas do Cloudflare (DurableObject, etc.)
//
// --loader:.wasm=dataurl: WASM files são inlined como data URLs
//
// Sem sourcemap para reduzir o tamanho do deploy
console.log("\n📦 Step 2: Bundling into single _worker.js...");

try {
  execSync(
    [
      "npx esbuild",
      `"${WORKER_ENTRY}"`,
      `--outfile="${OUTPUT_WORKER}"`,
      "--bundle",
      "--format=esm",
      "--platform=node",
      "--target=esnext",
      "--external:cloudflare:*",
      "--loader:.wasm=dataurl",
      "--allow-overwrite",
      "--log-level=warning",
    ].join(" "),
    {
      cwd: OPEN_NEXT_DIR,
      stdio: "inherit",
    }
  );
} catch (e) {
  console.error("❌ esbuild bundling failed!");
  process.exit(1);
}

// Step 4: Verify output
if (existsSync(OUTPUT_WORKER)) {
  const stats = statSync(OUTPUT_WORKER);
  console.log(
    `\n✅ _worker.js created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`
  );
} else {
  console.error("❌ _worker.js was not created!");
  process.exit(1);
}

console.log("\n🎉 Build complete for Cloudflare Pages!");
console.log("   Assets directory is clean (no node_modules, no symlinks)");
console.log(
  "   Deploy via CLI: npx wrangler pages deploy .open-next/assets --project-name=tabackvitrine-api\n"
);
