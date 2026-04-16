#!/bin/bash

# Script para criar pacote do projeto
# Execute: bun run scripts/pack.ts

import { $ } from 'bun'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const OUTPUT_DIR = join(process.cwd(), 'downloads')
const PROJECT_NAME = 'saas-ecommerce-platform'

async function main() {
  console.log('📦 Criando pacote do projeto...\n')
  
  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  
  // Create ZIP file excluding unnecessary files
  const excludePatterns = [
    'node_modules',
    '.next',
    '.git',
    'backups',
    'logs',
    'downloads',
    '*.log',
    '.env.local'
  ]
  
  const excludeArgs = excludePatterns.map(p => `--exclude="${p}"`).join(' ')
  
  console.log('📋 Arquivos a incluir:')
  console.log('   - Código fonte (src/)')
  console.log('   - Schema do Prisma (prisma/)')
  console.log('   - Banco de dados (db/)')
  console.log('   - Documentação (*.md)')
  console.log('   - Configurações (package.json, etc)')
  console.log('')
  console.log('📋 Arquivos a excluir:')
  console.log('   - node_modules/')
  console.log('   - .next/')
  console.log('   - .git/')
  console.log('   - backups/')
  console.log('   - logs/')
  console.log('')
  
  try {
    // Use tar to create archive
    const outputFile = join(OUTPUT_DIR, `${PROJECT_NAME}.tar.gz`)
    
    await $`tar -czvf ${outputFile} \
      --exclude='node_modules' \
      --exclude='.next' \
      --exclude='.git' \
      --exclude='backups' \
      --exclude='logs' \
      --exclude='downloads' \
      --exclude='*.log' \
      -C .. \
      my-project`.quiet()
    
    console.log('✅ Pacote criado com sucesso!')
    console.log(`📁 Local: ${outputFile}`)
    console.log('')
    
    // Get file size
    const file = Bun.file(outputFile)
    const sizeMB = (file.size / 1024 / 1024).toFixed(2)
    console.log(`📊 Tamanho: ${sizeMB} MB`)
    
  } catch (error) {
    console.error('❌ Erro ao criar pacote:', error)
    
    // Alternative: list files that would be included
    console.log('\n📁 Estrutura do projeto:')
    const files = [
      'src/app/api/**/*.ts',
      'src/lib/*.ts',
      'prisma/schema.prisma',
      'db/custom.db',
      'package.json',
      'API_DOCUMENTATION.md',
      'README.md',
      '.env'
    ]
    
    for (const pattern of files) {
      console.log(`   ${pattern}`)
    }
  }
}

main()
