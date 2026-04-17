import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neon } from '@neondatabase/serverless'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Configure it in Cloudflare Dashboard or .env file.')
  }

  // Neon serverless driver: usa HTTP em vez de TCP
  // O adapter PrismaNeon faz o Prisma funcionar em Edge Runtime sem precisar de /edge
  const sql = neon(connectionString)
  const adapter = new PrismaNeon(sql)

  return new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  })
}

// Lazy initialization: só cria o PrismaClient quando for acessado
let _db: PrismaClient | undefined = undefined

export function getDb(): PrismaClient {
  if (!_db) {
    _db = globalForPrisma.prisma ?? createPrismaClient()
    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = _db
  }
  return _db
}

// Mantém compatibilidade com o import `db` existente usando Proxy
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getDb()
    const value = (client as any)[prop]
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
})
