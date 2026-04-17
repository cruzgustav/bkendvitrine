#!/usr/bin/env node

/**
 * Build script para deploy no Cloudflare Pages via Painel (Dashboard)
 *
 * IMPORTANTE: No Cloudflare Pages Dashboard:
 *   - Build command: node scripts/build-pages.js
 *   - Build output directory: .open-next
 *   - Deploy command: DEIXAR VAZIO
 */

const { execSync, existsSync, renameSync, readdirSync, statSync, cpSync } = require('fs');
const { join, resolve } = require('path');

const ROOT_DIR = resolve(__dirname, '..');
const OPEN_NEXT_DIR = join(ROOT_DIR, '.open-next');
const NODE_MODULES_BIN = join(ROOT_DIR, 'node_modules', '.bin');

// Garantir que node_modules/.bin está no PATH
const currentPath = process.env.PATH || '';
if (!currentPath.includes(NODE_MODULES_BIN)) {
  process.env.PATH = `${NODE_MODULES_BIN}:${currentPath}`;
}

function run(cmd, label, required = true) {
  console.log(`\n🔧 ${label}...`);
  console.log(`   > ${cmd}`);
  console.log(`   PATH includes .bin: ${process.env.PATH.includes(NODE_MODULES_BIN)}`);
  try {
    execSync(cmd, {
      stdio: 'inherit',
      cwd: ROOT_DIR,
      timeout: 300000,
      env: { ...process.env }
    });
    console.log(`   ✅ ${label} concluído`);
    return true;
  } catch (error) {
    if (required) {
      console.error(`   ❌ ${label} falhou`);
      console.error(`   Exit code: ${error.status}`);
      if (error.stderr) console.error(`   stderr: ${error.stderr.toString().slice(0, 2000)}`);
      if (error.stdout) console.error(`   stdout: ${error.stdout.toString().slice(0, 2000)}`);
      process.exit(1);
    } else {
      console.warn(`   ⚠️  ${label} falhou (opcional)`);
      return false;
    }
  }
}

function ensurePrismaClient() {
  const prismaClientFile = join(ROOT_DIR, 'node_modules', '.prisma', 'client', 'index.js');
  if (existsSync(prismaClientFile)) {
    console.log('\n   ✅ Prisma Client já gerado');
    return;
  }
  console.log('\n   ⚠️  Prisma Client não encontrado, gerando...');
  run('prisma generate --schema=./prisma/schema.prisma', 'Gerando Prisma Client');
}

function restructureForPages() {
  console.log('\n🔧 Reestruturando output para Cloudflare Pages...');

  const workerJs = join(OPEN_NEXT_DIR, 'worker.js');
  const underscoreWorkerJs = join(OPEN_NEXT_DIR, '_worker.js');

  if (existsSync(underscoreWorkerJs)) {
    console.log('   ✅ _worker.js já existe');
  } else if (existsSync(workerJs)) {
    console.log('   📝 Renomeando worker.js → _worker.js...');
    renameSync(workerJs, underscoreWorkerJs);
    const workerMap = join(OPEN_NEXT_DIR, 'worker.js.map');
    const underscoreWorkerMap = join(OPEN_NEXT_DIR, '_worker.js.map');
    if (existsSync(workerMap)) renameSync(workerMap, underscoreWorkerMap);
    console.log('   ✅ _worker.js criado');
  } else {
    console.warn('   ⚠️  worker.js não encontrado');
  }

  const assetsDir = join(OPEN_NEXT_DIR, 'assets');
  if (existsSync(assetsDir)) {
    console.log('   📁 Movendo assets para raiz...');
    try {
      const assetItems = readdirSync(assetsDir);
      for (const item of assetItems) {
        const src = join(assetsDir, item);
        const dest = join(OPEN_NEXT_DIR, item);
        if (!existsSync(dest)) cpSync(src, dest, { recursive: true });
      }
      console.log(`   ✅ ${assetItems.length} itens movidos`);
    } catch (e) {
      console.warn(`   ⚠️  Erro: ${e.message}`);
    }
  }
}

function validateOutput() {
  console.log('\n📁 Validando output...');
  if (!existsSync(OPEN_NEXT_DIR)) {
    console.error('   ❌ .open-next/ não encontrado!');
    process.exit(1);
  }
  const workerFile = join(OPEN_NEXT_DIR, '_worker.js');
  if (existsSync(workerFile)) {
    const stat = statSync(workerFile);
    console.log(`   ✅ _worker.js (${(stat.size / 1024).toFixed(1)} KB)`);
  } else {
    console.error('   ❌ _worker.js NÃO encontrado!');
    process.exit(1);
  }

  console.log('\n📋 Conteúdo de .open-next/:');
  const items = readdirSync(OPEN_NEXT_DIR);
  for (const item of items.slice(0, 25)) {
    const itemPath = join(OPEN_NEXT_DIR, item);
    const stat = statSync(itemPath);
    if (stat.isDirectory()) {
      const subItems = readdirSync(itemPath);
      console.log(`   📁 ${item}/ (${subItems.length} itens)`);
    } else {
      console.log(`   📄 ${item} (${(stat.size / 1024).toFixed(1)} KB)`);
    }
  }
}

// ====== MAIN ======

console.log('🚀 Build para Cloudflare Pages');
console.log('='.repeat(50));

// Step 1: Garantir Prisma Client
ensurePrismaClient();

// Step 2: Build do OpenNext — usar o binário direto em vez de npx
const opennextBin = join(NODE_MODULES_BIN, 'opennextjs-cloudflare');
const buildCmd = existsSync(opennextBin)
  ? `${opennextBin} build`
  : 'npx @opennextjs/cloudflare build';

run(buildCmd, 'Build OpenNext');

// Step 3: Reestruturar para Pages
restructureForPages();

// Step 4: Validar
validateOutput();

console.log('\n' + '='.repeat(50));
console.log('🎉 Build concluído!');
