
import { db } from '@/lib/db'
import { verifyPassword, generateToken, apiResponse, apiError } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória')
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const validatedData = loginSchema.parse(body)
    
    // Find user
    const user = await db.user.findUnique({
      where: { email: validatedData.email }
    })
    
    if (!user) {
      return apiError('Email ou senha incorretos', 401)
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(validatedData.password, user.password)
    
    if (!isValidPassword) {
      return apiError('Email ou senha incorretos', 401)
    }
    
    // Generate token
    const token = generateToken(user.id)
    
    return apiResponse({
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role
      },
      token
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Login error:', error)
    return apiError('Erro ao fazer login', 500)
  }
}
