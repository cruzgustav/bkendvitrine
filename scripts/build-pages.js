#!/usr/bin/env node

/**
 * Build script para deploy no Cloudflare Pages via Painel (Dashboard)
 *
 * Este script:
 * 1. Gera o Prisma Client
 * 2. Executa o build do OpenNext para Cloudflare
 * 3. Garante que _worker.js exista no output (necessário para Pages)
 * 4. Valida a estrutura de saída
 *
 * Uso: node scripts/build-pages.js
 */

const { execSync, existsSync, renameSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

const ROOT_DIR = join(__dirname, '..');
const OPEN_NEXT_DIR = join(ROOT_DIR, '.open-next');

function run(cmd, label) {
  console.log(`\n🔧 ${label}...`);
  console.log(`   > ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT_DIR });
    console.log(`   ✅ ${label} concluído`);
  } catch (error) {
    console.error(`   ❌ ${label} falhou`);
    process.exit(1);
  }
}

function ensureWorkerJs() {
  // Cloudflare Pages procura por _worker.js no diretório de saída
  // OpenNext gera worker.js (formato Workers) — renomear para _worker.js (formato Pages)
  const workerJs = join(OPEN_NEXT_DIR, 'worker.js');
  const underscoreWorkerJs = join(OPEN_NEXT_DIR, '_worker.js');

  if (existsSync(underscoreWorkerJs)) {
    console.log('\n   ✅ _worker.js já existe — formato Pages correto');
    return;
  }

  if (existsSync(workerJs)) {
    console.log('\n   📝 Renomeando worker.js → _worker.js para compatibilidade com Pages...');
    renameSync(workerJs, underscoreWorkerJs);

    // Também renomear o source map se existir
    const workerMap = join(OPEN_NEXT_DIR, 'worker.js.map');
    const underscoreWorkerMap = join(OPEN_NEXT_DIR, '_worker.js.map');
    if (existsSync(workerMap)) {
      renameSync(workerMap, underscoreWorkerMap);
      console.log('   📝 worker.js.map → _worker.js.map');
    }

    console.log('   ✅ _worker.js criado com sucesso');
  } else {
    console.warn('\n   ⚠️  Nem worker.js nem _worker.js encontrado no output!');
    console.warn('   O build pode ter falhado ou a estrutura mudou.');
  }
}

function validateOutput() {
  console.log('\n📁 Validando estrutura do output...');

  if (!existsSync(OPEN_NEXT_DIR)) {
    console.error('   ❌ Diretório .open-next/ não encontrado!');
    process.exit(1);
  }

  const requiredItems = ['_worker.js'];
  const optionalItems = ['assets'];

  let allGood = true;
  for (const item of requiredItems) {
    const path = join(OPEN_NEXT_DIR, item);
    if (existsSync(path)) {
      const stat = statSync(path);
      const size = stat.size;
      console.log(`   ✅ ${item} (${(size / 1024).toFixed(1)} KB)`);
    } else {
      console.error(`   ❌ ${item} NÃO ENCONTRADO — deploy vai falhar!`);
      allGood = false;
    }
  }

  for (const item of optionalItems) {
    const path = join(OPEN_NEXT_DIR, item);
    if (existsSync(path)) {
      console.log(`   ✅ ${item}/ (presente)`);
    } else {
      console.warn(`   ⚠️  ${item}/ não encontrado (pode não ser necessário)`);
    }
  }

  if (!allGood) {
    console.error('\n❌ Validação falhou — corrija os erros acima antes do deploy.');
    process.exit(1);
  }

  // Listar conteúdo resumido
  console.log('\n📋 Conteúdo de .open-next/:');
  const items = readdirSync(OPEN_NEXT_DIR);
  for (const item of items.slice(0, 20)) {
    const itemPath = join(OPEN_NEXT_DIR, item);
    const stat = statSync(itemPath);
    if (stat.isDirectory()) {
      const subItems = readdirSync(itemPath);
      console.log(`   📁 ${item}/ (${subItems.length} arquivos)`);
    } else {
      console.log(`   📄 ${item} (${(stat.size / 1024).toFixed(1)} KB)`);
    }
  }
  if (items.length > 20) {
    console.log(`   ... e mais ${items.length - 20} itens`);
  }
}

// ====== MAIN ======

console.log('🚀 Build para Cloudflare Pages (deploy via Painel)');
console.log('='.repeat(50));

// Step 1: Gerar Prisma Client
run('npx prisma generate', 'Gerando Prisma Client');

// Step 2: Build do OpenNext para Cloudflare
run('npx @opennextjs/cloudflare build', 'Build OpenNext para Cloudflare');

// Step 3: Garantir _worker.js para Pages
ensureWorkerJs();

// Step 4: Validar output
validateOutput();

console.log('\n' + '='.repeat(50));
console.log('🎉 Build concluído com sucesso!');
console.log('📂 Diretório de saída: .open-next/');
console.log('');
console.log('Para deploy via Painel do Cloudflare:');
console.log('  1. Vá em Workers & Pages > Create > Pages > Connect to Git');
console.log('  2. Conecte o repositório');
console.log('  3. Build command: npm install && node scripts/build-pages.js');
console.log('  4. Output directory: .open-next');
console.log('  5. Em Settings > Functions, adicione flag: nodejs_compat');
console.log('');
