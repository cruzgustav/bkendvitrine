import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).optional(),
  paymentMethod: z.string().optional(),
  trackingNumber: z.string().optional(),
  shippingCarrier: z.string().optional(),
  internalNotes: z.string().optional()
})

// Get order by ID
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
    
    const order = await db.order.findFirst({
      where: { id, storeId: store.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true
              }
            },
            variant: true
          }
        },
        customer: true,
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    
    if (!order) {
      return apiError('Pedido não encontrado', 404)
    }
    
    return apiResponse({ order })
    
  } catch (error) {
    console.error('Get order error:', error)
    return apiError('Erro ao buscar pedido', 500)
  }
}

// Update order
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
    
    const order = await db.order.findFirst({
      where: { id, storeId: store.id }
    })
    
    if (!order) {
      return apiError('Pedido não encontrado', 404)
    }
    
    const body = await request.json()
    const validatedData = updateOrderSchema.parse(body)
    
    const updateData: any = { ...validatedData }
    
    // Set timestamps based on status
    if (validatedData.status === 'SHIPPED') {
      updateData.shippedAt = new Date()
    }
    
    if (validatedData.status === 'DELIVERED') {
      updateData.deliveredAt = new Date()
    }
    
    if (validatedData.status === 'CANCELLED') {
      updateData.cancelledAt = new Date()
      
      // Restore stock
      const items = await db.orderItem.findMany({
        where: { orderId: id }
      })
      
      for (const item of items) {
        if (item.variantId) {
          await db.productVariant.update({
            where: { id: item.variantId },
            data: { quantity: { increment: item.quantity } }
          })
        } else if (item.productId) {
          await db.product.update({
            where: { id: item.productId },
            data: { quantity: { increment: item.quantity } }
          })
        }
      }
    }
    
    const updatedOrder = await db.order.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        },
        customer: true
      }
    })
    
    return apiResponse({
      message: 'Pedido atualizado com sucesso',
      order: updatedOrder
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Update order error:', error)
    return apiError('Erro ao atualizar pedido', 500)
  }
}
