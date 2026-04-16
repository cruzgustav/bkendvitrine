import { 
  createDatabaseBackup, 
  createJsonBackup, 
  listBackups, 
  getDatabaseHealth 
} from '@/lib/backup'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'

// Necessário para uso do módulo 'fs' no Cloudflare Workers (nodejs_compat)
export const runtime = 'nodejs'

// Get backup status and list
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user || user.role !== 'ADMIN') {
      return unauthorizedError()
    }
    
    const health = await getDatabaseHealth()
    const backups = listBackups()
    
    return apiResponse({
      health,
      backups,
      backupDirectory: '/home/z/my-project/backups'
    })
    
  } catch (error) {
    console.error('Get backup status error:', error)
    return apiError('Erro ao buscar status de backup', 500)
  }
}

// Create new backup
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user || user.role !== 'ADMIN') {
      return unauthorizedError()
    }
    
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all' // 'db', 'json', or 'all'
    
    const results: any = {}
    
    if (type === 'all' || type === 'db') {
      results.database = await createDatabaseBackup()
    }
    
    if (type === 'all' || type === 'json') {
      results.json = await createJsonBackup()
    }
    
    return apiResponse({
      message: 'Backup criado com sucesso',
      backups: results
    })
    
  } catch (error) {
    console.error('Create backup error:', error)
    return apiError('Erro ao criar backup', 500)
  }
}
