#!/usr/bin/env node

/**
 * Build script para deploy no Cloudflare Pages via Painel (Dashboard)
 *
 * IMPORTANTE: No Cloudflare Pages Dashboard:
 *   - Build command: node scripts/build-pages.js
 *   - Build output directory: .open-next
 *   - Deploy command: DEIXAR VAZIO (Pages deploya automaticamente)
 */

const { execSync, existsSync, renameSync, readdirSync, statSync, cpSync } = require('fs');
const { join } = require('path');

const ROOT_DIR = join(__dirname, '..');
const OPEN_NEXT_DIR = join(ROOT_DIR, '.open-next');

function run(cmd, label, required = true) {
  console.log(`\n🔧 ${label}...`);
  console.log(`   > ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT_DIR, timeout: 300000 });
    console.log(`   ✅ ${label} concluído`);
    return true;
  } catch (error) {
    if (required) {
      console.error(`   ❌ ${label} falhou`);
      console.error(`   Exit code: ${error.status}`);
      if (error.stderr) console.error(`   stderr: ${error.stderr.toString().slice(0, 1000)}`);
      if (error.stdout) console.error(`   stdout: ${error.stdout.toString().slice(0, 1000)}`);
      process.exit(1);
    } else {
      console.warn(`   ⚠️  ${label} falhou (opcional, continuando...)`);
      return false;
    }
  }
}

function ensurePrismaClient() {
  // Verifica se o Prisma Client já foi gerado (pelo postinstall)
  const prismaClientDir = join(ROOT_DIR, 'node_modules', '.prisma', 'client');
  const prismaClientFile = join(prismaClientDir, 'index.js');

  if (existsSync(prismaClientFile)) {
    console.log('\n   ✅ Prisma Client já gerado (via postinstall)');
    return;
  }

  // Se não foi gerado, tentar gerar manualmente
  console.log('\n   ⚠️  Prisma Client não encontrado, gerando...');
  const prismaBin = join(ROOT_DIR, 'node_modules', '.bin', 'prisma');
  const cmd = existsSync(prismaBin)
    ? `${prismaBin} generate --schema=./prisma/schema.prisma`
    : 'npx prisma generate --schema=./prisma/schema.prisma';

  run(cmd, 'Gerando Prisma Client');
}

function restructureForPages() {
  console.log('\n🔧 Reestruturando output para Cloudflare Pages...');

  // 1. Renomear worker.js → _worker.js
  const workerJs = join(OPEN_NEXT_DIR, 'worker.js');
  const underscoreWorkerJs = join(OPEN_NEXT_DIR, '_worker.js');

  if (existsSync(underscoreWorkerJs)) {
    console.log('   ✅ _worker.js já existe');
  } else if (existsSync(workerJs)) {
    console.log('   📝 Renomeando worker.js → _worker.js...');
    renameSync(workerJs, underscoreWorkerJs);

    const workerMap = join(OPEN_NEXT_DIR, 'worker.js.map');
    const underscoreWorkerMap = join(OPEN_NEXT_DIR, '_worker.js.map');
    if (existsSync(workerMap)) {
      renameSync(workerMap, underscoreWorkerMap);
    }
    console.log('   ✅ _worker.js criado');
  } else {
    console.warn('   ⚠️  worker.js não encontrado');
  }

  // 2. Mover assets/ para a raiz do output
  const assetsDir = join(OPEN_NEXT_DIR, 'assets');
  if (existsSync(assetsDir)) {
    console.log('   📁 Movendo assets para raiz do output...');
    try {
      const assetItems = readdirSync(assetsDir);
      for (const item of assetItems) {
        const src = join(assetsDir, item);
        const dest = join(OPEN_NEXT_DIR, item);
        if (!existsSync(dest)) {
          cpSync(src, dest, { recursive: true });
        }
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

// Step 2: Build do OpenNext
run('npx @opennextjs/cloudflare build', 'Build OpenNext');

// Step 3: Reestruturar para Pages
restructureForPages();

// Step 4: Validar
validateOutput();

console.log('\n' + '='.repeat(50));
console.log('🎉 Build concluído!');
