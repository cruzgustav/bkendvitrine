
import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const updateCouponSchema = z.object({
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  value: z.number().positive().optional(),
  minPurchase: z.number().positive().nullable().optional(),
  maxDiscount: z.number().positive().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perCustomer: z.number().int().positive().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  isActive: z.boolean().optional()
})

// Get coupon by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    const { id } = await params
    
    const coupon = await db.coupon.findFirst({
      where: { id, storeId: store.id }
    })
    
    if (!coupon) {
      return apiError('Cupom não encontrado', 404)
    }
    
    return apiResponse({ coupon })
    
  } catch (error) {
    console.error('Get coupon error:', error)
    return apiError('Erro ao buscar cupom', 500)
  }
}

// Update coupon
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    const { id } = await params
    
    const coupon = await db.coupon.findFirst({
      where: { id, storeId: store.id }
    })
    
    if (!coupon) {
      return apiError('Cupom não encontrado', 404)
    }
    
    const body = await request.json()
    const validatedData = updateCouponSchema.parse(body)
    
    const updateData: any = { ...validatedData }
    
    if (validatedData.startDate !== undefined) {
      updateData.startDate = validatedData.startDate ? new Date(validatedData.startDate) : null
    }
    
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null
    }
    
    const updatedCoupon = await db.coupon.update({
      where: { id },
      data: updateData
    })
    
    return apiResponse({
      message: 'Cupom atualizado com sucesso',
      coupon: updatedCoupon
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Update coupon error:', error)
    return apiError('Erro ao atualizar cupom', 500)
  }
}

// Delete coupon
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    const { id } = await params
    
    const coupon = await db.coupon.findFirst({
      where: { id, storeId: store.id }
    })
    
    if (!coupon) {
      return apiError('Cupom não encontrado', 404)
    }
    
    await db.coupon.delete({
      where: { id }
    })
    
    return apiResponse({
      message: 'Cupom excluído com sucesso'
    })
    
  } catch (error) {
    console.error('Delete coupon error:', error)
    return apiError('Erro ao excluir cupom', 500)
  }
}
