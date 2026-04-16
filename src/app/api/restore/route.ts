import { db } from '@/lib/db'
import { readFileSync, existsSync, copyFileSync } from 'fs'
import { join } from 'path'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'

// Necessário para uso do módulo 'fs' no Cloudflare Workers (nodejs_compat)
export const runtime = 'nodejs'

const BACKUP_DIR = join(process.cwd(), 'backups')
const DB_PATH = join(process.cwd(), 'db', 'custom.db')

// Restore from backup
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user || user.role !== 'ADMIN') {
      return unauthorizedError()
    }
    
    const body = await request.json()
    const { backupFile, type } = body as { backupFile: string; type: 'database' | 'json' }
    
    if (!backupFile) {
      return apiError('Nome do arquivo de backup é obrigatório', 400)
    }
    
    const backupPath = join(BACKUP_DIR, backupFile)
    
    if (!existsSync(backupPath)) {
      return apiError('Arquivo de backup não encontrado', 404)
    }
    
    if (type === 'database') {
      // Restore SQLite database
      // First, backup current state
      const currentBackup = `${DB_PATH}.pre-restore-${Date.now()}`
      copyFileSync(DB_PATH, currentBackup)
      
      // Then restore
      copyFileSync(backupPath, DB_PATH)
      
      return apiResponse({
        message: 'Banco de dados restaurado com sucesso',
        previousBackupCreated: currentBackup,
        note: 'Reinicie o servidor para aplicar as alterações'
      })
    } else if (type === 'json') {
      // Restore from JSON (insert data)
      const jsonData = JSON.parse(readFileSync(backupPath, 'utf-8'))
      
      // This is a dangerous operation, so we'll be careful
      // For now, just return info about what would be restored
      return apiResponse({
        message: 'Dados do JSON carregados',
        backupInfo: {
          timestamp: jsonData.timestamp,
          version: jsonData.version,
          tables: Object.keys(jsonData.data),
          counts: Object.fromEntries(
            Object.entries(jsonData.data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
          )
        },
        note: 'Use o endpoint /api/restore/confirm para confirmar a restauração dos dados JSON'
      })
    }
    
    return apiError('Tipo de backup inválido', 400)
    
  } catch (error) {
    console.error('Restore error:', error)
    return apiError('Erro ao restaurar backup', 500)
  }
}
