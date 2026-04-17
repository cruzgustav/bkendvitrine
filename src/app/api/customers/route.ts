
import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const createCustomerSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional()
})

// Get customers for user's store
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const store = await db.store.findUnique({
      where: { userId: user.id }
    })
    
    if (!store) {
      return apiError('Loja não encontrada', 404)
    }
    
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit
    
    const where: any = { storeId: store.id }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } }
      ]
    }
    
    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        include: {
          _count: {
            select: { orders: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.customer.count({ where })
    ])
    
    return apiResponse({
      customers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
    
  } catch (error) {
    console.error('Get customers error:', error)
    return apiError('Erro ao buscar clientes', 500)
  }
}

// Create customer
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const store = await db.store.findUnique({
      where: { userId: user.id }
    })
    
    if (!store) {
      return apiError('Loja não encontrada', 404)
    }
    
    const body = await request.json()
    const validatedData = createCustomerSchema.parse(body)
    
    // Check if customer already exists
    const existingCustomer = await db.customer.findFirst({
      where: { storeId: store.id, email: validatedData.email }
    })
    
    if (existingCustomer) {
      return apiError('Cliente já existe com este email', 400)
    }
    
    const customer = await db.customer.create({
      data: {
        storeId: store.id,
        ...validatedData
      }
    })
    
    return apiResponse({
      message: 'Cliente criado com sucesso',
      customer
    }, 201)
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Create customer error:', error)
    return apiError('Erro ao criar cliente', 500)
  }
}
