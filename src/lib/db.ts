import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getConnectionString(): string {
  // No Cloudflare Workers: tenta acessar o Hyperdrive binding
  // O OpenNext armazena o env do Cloudflare no AsyncLocalStorage
  try {
    const cloudflareContext = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    if (cloudflareContext?.env?.HYPERDRIVE) {
      return cloudflareContext.env.HYPERDRIVE.connectionString
    }
  } catch {
    // Ignora se não estiver no Cloudflare Workers
  }

  // Fallback: usa DATABASE_URL (dev local ou sem Hyperdrive)
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Configure it in Cloudflare Dashboard or .env file.')
  }
  return connectionString
}

function createPrismaClient() {
  const connectionString = getConnectionString()

  const pool = new pg.Pool({ connectionString })
  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
