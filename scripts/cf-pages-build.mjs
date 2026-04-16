#!/usr/bin/env node
/**
 * Script de build para Cloudflare Pages
 *
 * O Cloudflare Pages exige que o código do Worker esteja em um arquivo
 * `_worker.js` dentro do diretório de assets estáticos.
 *
 * Este script:
 * 1. Executa o build do OpenNext para Cloudflare
 * 2. Usa esbuild para bundlar o worker.js + dependências em `_worker.js`
 * 3. Módulos nativos do Node.js são external (resolvidos pelo nodejs_compat)
 * 4. WASM files são copiados como dataurl (inline no bundle)
 * 5. Pronto para `wrangler pages deploy .open-next/assets`
 */

import { execSync } from "child_process";
import { existsSync, statSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const OPEN_NEXT_DIR = join(ROOT, ".open-next");
const ASSETS_DIR = join(OPEN_NEXT_DIR, "assets");
const WORKER_ENTRY = join(OPEN_NEXT_DIR, "worker.js");
const OUTPUT_WORKER = join(ASSETS_DIR, "_worker.js");

// Node.js built-in modules que são external (resolvidos pelo nodejs_compat do Cloudflare)
const NODE_BUILTINS = [
  "node:*",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "console",
  "constants",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "domain",
  "events",
  "fs",
  "http",
  "http2",
  "https",
  "inspector",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "repl",
  "stream",
  "string_decoder",
  "sys",
  "timers",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
].map((m) => `--external:${m}`).join(" ");

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

// Step 3: Bundle the worker into _worker.js for Pages
console.log("\n📦 Step 2: Bundling worker for Cloudflare Pages...");
try {
  execSync(
    `npx esbuild "${WORKER_ENTRY}" ` +
      `--outfile="${OUTPUT_WORKER}" ` +
      `--bundle ` +
      `--format=esm ` +
      `--platform=neutral ` +
      `--target=esnext ` +
      `--external:cloudflare:* ` +
      `${NODE_BUILTINS} ` +
      `--loader:.wasm=dataurl ` +
      `--allow-overwrite ` +
      `--sourcemap ` +
      `--log-level=warning ` +
      `--define:process.env.NODE_ENV='"production"'`,
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
console.log(
  "   Run: npx wrangler pages deploy .open-next/assets --project-name=tabackvitrine-api\n"
);
