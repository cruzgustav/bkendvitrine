import { db } from './db'
import { writeFileSync, existsSync, copyFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'

const BACKUP_DIR = join(process.cwd(), 'backups')
const DB_PATH = join(process.cwd(), 'db', 'custom.db')

// Ensure backup directory exists
export function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true })
  }
}

// Create full database backup (SQLite file copy)
export async function createDatabaseBackup(): Promise<string> {
  ensureBackupDir()
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFileName = `db-backup-${timestamp}.db`
  const backupPath = join(BACKUP_DIR, backupFileName)
  
  // Copy SQLite database file
  copyFileSync(DB_PATH, backupPath)
  
  // Also create JSON export for extra safety
  const jsonBackup = await createJsonBackup()
  
  // Cleanup old backups (keep last 10)
  cleanupOldBackups(10)
  
  return backupPath
}

// Create JSON backup of all data
export async function createJsonBackup(): Promise<string> {
  ensureBackupDir()
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFileName = `data-backup-${timestamp}.json`
  const backupPath = join(BACKUP_DIR, backupFileName)
  
  // Export all data to JSON
  const data = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    data: {
      users: await db.user.findMany(),
      stores: await db.store.findMany(),
      categories: await db.category.findMany(),
      products: await db.product.findMany(),
      productImages: await db.productImage.findMany(),
      productVariants: await db.productVariant.findMany(),
      orders: await db.order.findMany(),
      orderItems: await db.orderItem.findMany(),
      customers: await db.customer.findMany(),
      payments: await db.payment.findMany(),
      subscriptions: await db.subscription.findMany(),
      plans: await db.plan.findMany(),
      coupons: await db.coupon.findMany(),
      storeCustomizations: await db.storeCustomization.findMany(),
      storeSettings: await db.storeSetting.findMany(),
      productReviews: await db.productReview.findMany(),
      storeAnalytics: await db.storeAnalytics.findMany(),
      systemSettings: await db.systemSetting.findMany()
    }
  }
  
  writeFileSync(backupPath, JSON.stringify(data, null, 2))
  
  return backupPath
}

// List all backups
export function listBackups() {
  ensureBackupDir()
  
  const files = readdirSync(BACKUP_DIR)
  
  return files
    .filter(f => f.endsWith('.db') || f.endsWith('.json'))
    .map(f => {
      const filePath = join(BACKUP_DIR, f)
      const stats = statSync(filePath)
      return {
        filename: f,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime,
        type: f.endsWith('.db') ? 'database' : 'json'
      }
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

// Cleanup old backups, keep only the latest N
function cleanupOldBackups(keepCount: number) {
  const backups = listBackups()
  
  // Separate by type
  const dbBackups = backups.filter(b => b.type === 'database')
  const jsonBackups = backups.filter(b => b.type === 'json')
  
  // Remove old database backups
  dbBackups.slice(keepCount).forEach(b => {
    try {
      unlinkSync(b.path)
    } catch (e) {
      console.error('Failed to delete old backup:', b.filename)
    }
  })
  
  // Remove old JSON backups
  jsonBackups.slice(keepCount).forEach(b => {
    try {
      unlinkSync(b.path)
    } catch (e) {
      console.error('Failed to delete old backup:', b.filename)
    }
  })
}

// Get database health status
export async function getDatabaseHealth() {
  try {
    const tables = [
      'users', 'stores', 'products', 'categories', 'orders', 
      'customers', 'payments', 'subscriptions', 'plans'
    ]
    
    const counts: Record<string, number> = {}
    
    for (const table of tables) {
      try {
        // @ts-ignore - dynamic model access
        counts[table] = await db[table].count()
      } catch {
        counts[table] = -1 // Error counting
      }
    }
    
    const dbExists = existsSync(DB_PATH)
    const backups = listBackups()
    
    return {
      status: 'healthy',
      databaseExists: dbExists,
      databasePath: DB_PATH,
      tables: counts,
      lastBackup: backups[0]?.createdAt || null,
      totalBackups: backups.length
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      databasePath: DB_PATH
    }
  }
}
