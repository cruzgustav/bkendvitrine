
import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'

// Get subscription by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const { id } = await params
    
    const subscription = await db.subscription.findFirst({
      where: { id, userId: user.id },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    
    if (!subscription) {
      return apiError('Assinatura não encontrada', 404)
    }
    
    return apiResponse({ subscription })
    
  } catch (error) {
    console.error('Get subscription error:', error)
    return apiError('Erro ao buscar assinatura', 500)
  }
}

// Cancel subscription
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const { id } = await params
    
    const subscription = await db.subscription.findFirst({
      where: { id, userId: user.id }
    })
    
    if (!subscription) {
      return apiError('Assinatura não encontrada', 404)
    }
    
    if (subscription.status === 'CANCELLED') {
      return apiError('Assinatura já está cancelada', 400)
    }
    
    // Mark for cancellation at period end
    await db.subscription.update({
      where: { id },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date()
      }
    })
    
    return apiResponse({
      message: 'Assinatura será cancelada ao final do período atual'
    })
    
  } catch (error) {
    console.error('Cancel subscription error:', error)
    return apiError('Erro ao cancelar assinatura', 500)
  }
}
