import { PrismaClient } from '@prisma/client/edge'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // No Cloudflare Workers: tenta usar Hyperdrive connection string
  // O Hyperdrive fornece uma connection string que aponta para o pool TCP do CF
  let connectionString = process.env.DATABASE_URL

  try {
    const cloudflareContext = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    if (cloudflareContext?.env?.HYPERDRIVE?.connectionString) {
      connectionString = cloudflareContext.env.HYPERDRIVE.connectionString
    }
  } catch {
    // Ignora se não estiver no Cloudflare Workers
  }

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Configure it in Cloudflare Dashboard or .env file.')
  }

  return new PrismaClient({
    datasourceUrl: connectionString,
    log: ['error', 'warn'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
