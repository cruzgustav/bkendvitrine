import { db } from '@/lib/db'
import { hashPassword, generateToken, apiResponse, apiError } from '@/lib/auth'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  phone: z.string().optional()
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const validatedData = registerSchema.parse(body)
    
    // Verifica se o usuário já existe
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email }
    })
    
    if (existingUser) {
      return apiError('Este email já está cadastrado', 400)
    }
    
    // Criptografa a senha
    const hashedPassword = await hashPassword(validatedData.password)
    
    // Gera um slug único para a loja (ex: gustavo-novaes-cruz-loja-171234567890)
    const safeName = validatedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const uniqueSlug = `${safeName}-loja-${Date.now()}`;
    
    // Cria o usuário e a loja na mesma transação
    const user = await db.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        phone: validatedData.phone,
        
        // Cria a loja vinculada a este usuário automaticamente
        store: { 
          create: {
            name: 'Minha Vitrine',
            slug: uniqueSlug
          }
        }
      },
      include: {
        store: true 
      }
    })
    
    // Gera o token de autenticação
    const token = generateToken(user.id)
    
    return apiResponse({
      message: 'Usuário e loja criados com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      },
      token
    }, 201)
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {}
      error.errors.forEach(err => {
        const field = err.path.join('.')
        if (!errors[field]) errors[field] = []
        errors[field].push(err.message)
      })
      return apiError('Dados inválidos', 400, errors)
    }
    
    console.error('Register error:', error)
    return apiError('Erro ao criar usuário', 500)
  }
}