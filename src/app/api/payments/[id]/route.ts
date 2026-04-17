
import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'

// Get payment by ID
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
    
    const payment = await db.payment.findFirst({
      where: { id, userId: user.id },
      include: {
        order: true,
        subscription: {
          include: {
            plan: true
          }
        }
      }
    })
    
    if (!payment) {
      return apiError('Pagamento não encontrado', 404)
    }
    
    return apiResponse({ payment })
    
  } catch (error) {
    console.error('Get payment error:', error)
    return apiError('Erro ao buscar pagamento', 500)
  }
}
