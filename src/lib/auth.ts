import { db } from './db'
import { NextRequest } from 'next/server'
import { User } from '@prisma/client/edge'

// Simple password hashing using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const hash = await hashPassword(password)
  return hash === hashedPassword
}

// Simple JWT-like token generation
export function generateToken(userId: string): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ 
    userId, 
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  }))
  const signature = btoa(`${header}.${payload}.${process.env.JWT_SECRET || 'default-secret-key'}`)
  return `${header}.${payload}.${signature}`
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const payload = JSON.parse(atob(parts[1]))
    if (payload.exp < Date.now()) return null
    
    return { userId: payload.userId }
  } catch {
    return null
  }
}

// Get user from request
export async function getUserFromRequest(request: NextRequest): Promise<User | null> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  
  if (!token) return null
  
  const payload = verifyToken(token)
  if (!payload) return null
  
  const user = await db.user.findUnique({
    where: { id: payload.userId }
  })
  
  return user
}

// Generate unique slug
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

// Generate order number
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `ORD-${timestamp}-${random}`
}

// API Response helpers
export function apiResponse(data: unknown, status = 200) {
  return Response.json(data, { status })
}

export function apiError(message: string, status = 400, errors?: Record<string, string[]>) {
  return Response.json({ error: message, errors }, { status })
}

export function unauthorizedError() {
  return Response.json({ error: 'Não autorizado' }, { status: 401 })
}
