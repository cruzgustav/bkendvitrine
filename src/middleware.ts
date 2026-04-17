import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware CORS global para todas as rotas /api/*
 *
 * - Adiciona headers CORS em TODAS as respostas da API
 * - Trata requisições preflight OPTIONS automaticamente
 * - Origens permitidas configuráveis via variável de ambiente CORS_ALLOWED_ORIGINS
 * - Em desenvolvimento, permite todas as origens (*)
 *
 * RODA NA EDGE RUNTIME - obrigatório para Cloudflare Workers
 */

// Forçar edge runtime (necessário para Cloudflare Workers)

// Origens permitidas (separadas por vírgula na env var)
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(o => o.trim()).filter(Boolean)
  }
  // Em desenvolvimento, permitir tudo
  return ['*']
}

// Headers CORS padrão
function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin') || ''
  const allowedOrigins = getAllowedOrigins()

  // Determinar o valor de Access-Control-Allow-Origin
  let allowOrigin = '*'
  if (allowedOrigins.includes('*')) {
    allowOrigin = '*'
  } else if (allowedOrigins.includes(origin)) {
    // Retornar a origem específica (necessário para credenciais)
    allowOrigin = origin
  } else if (allowedOrigins.length > 0) {
    // Se a origem não está na lista mas temos origens configuradas, usar a primeira
    allowOrigin = allowedOrigins[0]
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24h cache do preflight
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Aplicar CORS apenas em rotas /api/*
  if (pathname.startsWith('/api/')) {
    const corsHeaders = getCorsHeaders(request)

    // Tratar preflight OPTIONS
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      })
    }

    // Para outras requisições, continuar e adicionar headers CORS na resposta
    const response = NextResponse.next()
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
