#!/usr/bin/env node
/**
 * Script de build para Cloudflare Pages
 *
 * Estratégia: copiar o worker.js como _worker.js + todos os arquivos de
 * suporte para o diretório de assets. O wrangler do Cloudflare faz o
 * bundling dele mesmo (ele conhece o runtime e o nodejs_compat).
 *
 * O _worker.js mantém os imports relativos intactos, e o wrangler
 * resolve tudo durante o deploy — assim como faz com wrangler deploy
 * para Workers.
 */

import { execSync } from "child_process";
import { existsSync, cpSync, renameSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dirname, "..");
const OPEN_NEXT_DIR = join(ROOT, ".open-next");
const ASSETS_DIR = join(OPEN_NEXT_DIR, "assets");

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
const workerJs = join(OPEN_NEXT_DIR, "worker.js");
if (!existsSync(workerJs)) {
  console.error("❌ worker.js not found in .open-next/ directory!");
  process.exit(1);
}

if (!existsSync(ASSETS_DIR)) {
  console.error("❌ Assets directory not found in .open-next/assets/!");
  process.exit(1);
}

// Step 3: Copy worker.js → assets/_worker.js (entry point do Pages)
console.log("\n📦 Step 2: Preparing assets for Cloudflare Pages...");

const workerDest = join(ASSETS_DIR, "_worker.js");
renameSync(workerJs, workerDest);
console.log("  ✅ worker.js → _worker.js");

// Step 4: Copy supporting directories into assets/ so that relative
// imports in _worker.js can be resolved by wrangler's bundler.
const dirsToCopy = ["cloudflare", "middleware", "server-functions", ".build"];

for (const dir of dirsToCopy) {
  const src = join(OPEN_NEXT_DIR, dir);
  const dest = join(ASSETS_DIR, dir);
  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
    console.log(`  ✅ ${dir}/ → assets/${dir}/`);
  } else {
    console.log(`  ⚠️  ${dir}/ not found, skipping`);
  }
}

// Step 5: Copy cloudflare-templates if they exist
const shimsDir = join(OPEN_NEXT_DIR, "cloudflare-templates");
if (existsSync(shimsDir)) {
  const shimsDest = join(ASSETS_DIR, "cloudflare-templates");
  cpSync(shimsDir, shimsDest, { recursive: true });
  console.log("  ✅ cloudflare-templates/ → assets/");
}

// Step 6: Create .pagesignore to exclude server-side code from
// static asset uploads (they're already bundled into the worker)
writeFileSync(
  join(ASSETS_DIR, ".pagesignore"),
  `# Server-side code (already bundled into _worker.js by wrangler)
node_modules/
server-functions/
middleware/
cloudflare/
.build/
cloudflare-templates/
_worker.js.map
`
);
console.log("  ✅ .pagesignore created");

console.log("\n🎉 Build complete for Cloudflare Pages!");
console.log(
  "   Deploy via CLI: npx wrangler pages deploy .open-next/assets --project-name=tabackvitrine-api\n"
);
