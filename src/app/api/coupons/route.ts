
import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const createCouponSchema = z.object({
  code: z.string().min(3, 'Código deve ter pelo menos 3 caracteres').max(20).toUpperCase(),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED']),
  value: z.number().positive('Valor deve ser positivo'),
  minPurchase: z.number().positive().optional(),
  maxDiscount: z.number().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  perCustomer: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
})

// Get coupons for user's store
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
    
    const coupons = await db.coupon.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: 'desc' }
    })
    
    return apiResponse({ coupons })
    
  } catch (error) {
    console.error('Get coupons error:', error)
    return apiError('Erro ao buscar cupons', 500)
  }
}

// Create coupon
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
    const validatedData = createCouponSchema.parse(body)
    
    // Check if coupon code already exists
    const existingCoupon = await db.coupon.findFirst({
      where: { storeId: store.id, code: validatedData.code }
    })
    
    if (existingCoupon) {
      return apiError('Cupom com este código já existe', 400)
    }
    
    const coupon = await db.coupon.create({
      data: {
        storeId: store.id,
        code: validatedData.code.toUpperCase(),
        description: validatedData.description,
        type: validatedData.type,
        value: validatedData.value,
        minPurchase: validatedData.minPurchase,
        maxDiscount: validatedData.maxDiscount,
        usageLimit: validatedData.usageLimit,
        perCustomer: validatedData.perCustomer,
        startDate: validatedData.startDate ? new Date(validatedData.startDate) : undefined,
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined
      }
    })
    
    return apiResponse({
      message: 'Cupom criado com sucesso',
      coupon
    }, 201)
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Create coupon error:', error)
    return apiError('Erro ao criar cupom', 500)
  }
}
