#!/usr/bin/env node

/**
 * Script auxiliar: renomeia worker.js → _worker.js e move assets
 * Roda DEPOIS do build do OpenNext
 */

const { existsSync, renameSync, readdirSync, statSync, cpSync } = require('fs');
const { join } = require('path');

const OPEN_NEXT_DIR = join(__dirname, '..', '.open-next');

if (!existsSync(OPEN_NEXT_DIR)) {
  console.error('❌ .open-next/ não encontrado!');
  process.exit(1);
}

// 1. Renomear worker.js → _worker.js
const workerJs = join(OPEN_NEXT_DIR, 'worker.js');
const underscoreWorkerJs = join(OPEN_NEXT_DIR, '_worker.js');

if (existsSync(underscoreWorkerJs)) {
  console.log('✅ _worker.js já existe');
} else if (existsSync(workerJs)) {
  console.log('📝 Renomeando worker.js → _worker.js...');
  renameSync(workerJs, underscoreWorkerJs);
  const workerMap = join(OPEN_NEXT_DIR, 'worker.js.map');
  if (existsSync(workerMap)) {
    renameSync(workerMap, join(OPEN_NEXT_DIR, '_worker.js.map'));
  }
  console.log('✅ _worker.js criado');
}

// 2. Mover assets para raiz
const assetsDir = join(OPEN_NEXT_DIR, 'assets');
if (existsSync(assetsDir)) {
  console.log('📁 Movendo assets para raiz...');
  const items = readdirSync(assetsDir);
  for (const item of items) {
    const src = join(assetsDir, item);
    const dest = join(OPEN_NEXT_DIR, item);
    if (!existsSync(dest)) {
      cpSync(src, dest, { recursive: true });
    }
  }
  console.log(`✅ ${items.length} itens movidos`);
}

console.log('🎉 Reestruturação concluída!');
