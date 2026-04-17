import { apiResponse, apiError, unauthorizedError } from '@/lib/auth'

export const runtime = 'edge'

// Backup e Restore usam 'fs' (sistema de arquivos) que não funciona no Cloudflare Edge.
// Essas rotas estão desabilitadas no deploy Cloudflare.
// Para backup/restore, rode localmente com `npm run dev`.

export async function GET(request: Request) {
  return apiError('Rotas de backup/restore não estão disponíveis no Cloudflare Edge. Rode localmente para usar backup/restore.', 501)
}

export async function POST(request: Request) {
  return apiError('Rotas de backup/restore não estão disponíveis no Cloudflare Edge. Rode localmente para usar backup/restore.', 501)
}
