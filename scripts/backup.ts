#!/usr/bin/env bun

/**
 * Automatic Backup Script
 * Run this script periodically (via cron) or before server restarts
 * 
 * Usage:
 *   bun run scripts/backup.ts
 * 
 * Cron example (every hour):
 *   0 * * * * cd /home/z/my-project && bun run scripts/backup.ts >> logs/backup.log 2>&1
 */

import { createDatabaseBackup, createJsonBackup, ensureBackupDir } from '../src/lib/backup'
import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const LOG_FILE = join(process.cwd(), 'logs', 'backup.log')

function log(message: string) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  console.log(logMessage.trim())
  
  try {
    ensureBackupDir()
    const logsDir = join(process.cwd(), 'logs')
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true })
    appendFileSync(LOG_FILE, logMessage)
  } catch (e) {
    console.error('Failed to write to log file:', e)
  }
}

async function main() {
  log('=== Starting automatic backup ===')
  
  try {
    // Create database backup
    log('Creating database backup...')
    const dbBackup = await createDatabaseBackup()
    log(`Database backup created: ${dbBackup}`)
    
    // Create JSON backup
    log('Creating JSON backup...')
    const jsonBackup = await createJsonBackup()
    log(`JSON backup created: ${jsonBackup}`)
    
    log('=== Backup completed successfully ===')
    
  } catch (error) {
    log(`ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

main()
