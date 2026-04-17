
import { db } from '@/lib/db'
import { apiResponse, apiError } from '@/lib/auth'
import { z } from 'zod'

// Webhook for Infinity Pay notifications
const webhookSchema = z.object({
  id: z.string(), // Infinity Pay payment ID
  event: z.enum(['payment.created', 'payment.confirmed', 'payment.failed', 'payment.refunded']),
  data: z.object({
    id: z.string(),
    status: z.enum(['pending', 'paid', 'failed', 'refunded']),
    amount: z.number(),
    paid_at: z.string().optional(),
    failed_at: z.string().optional(),
    refunded_at: z.string().optional(),
    error_code: z.string().optional(),
    error_message: z.string().optional()
  })
})

export async function POST(request: Request) {
  try {
    // Verify webhook signature (in production)
    // const signature = request.headers.get('x-infinitypay-signature')
    // if (!verifySignature(signature, body)) {
    //   return apiError('Invalid signature', 401)
    // }
    
    const body = await request.json()
    const validatedData = webhookSchema.parse(body)
    
    // Find payment by Infinity Pay ID
    const payment = await db.payment.findFirst({
      where: { infinityPayId: validatedData.id }
    })
    
    if (!payment) {
      return apiError('Pagamento não encontrado', 404)
    }
    
    // Update payment status
    const updateData: any = {
      status: validatedData.data.status.toUpperCase() as any,
      errorCode: validatedData.data.error_code,
      errorMessage: validatedData.data.error_message
    }
    
    if (validatedData.data.paid_at) {
      updateData.paidAt = new Date(validatedData.data.paid_at)
    }
    
    if (validatedData.data.failed_at) {
      updateData.failedAt = new Date(validatedData.data.failed_at)
    }
    
    if (validatedData.data.refunded_at) {
      updateData.refundedAt = new Date(validatedData.data.refunded_at)
    }
    
    await db.payment.update({
      where: { id: payment.id },
      data: updateData
    })
    
    // If payment is confirmed, activate subscription or order
    if (validatedData.data.status === 'paid') {
      // Activate subscription if exists
      if (payment.subscriptionId) {
        await db.subscription.update({
          where: { id: payment.subscriptionId },
          data: { status: 'ACTIVE' }
        })
        
        // Activate store
        const subscription = await db.subscription.findUnique({
          where: { id: payment.subscriptionId },
          include: { user: { include: { store: true } } }
        })
        
        if (subscription?.user?.store) {
          await db.store.update({
            where: { id: subscription.user.store.id },
            data: { isActive: true }
          })
        }
      }
      
      // Update order status if exists
      if (payment.orderId) {
        await db.order.update({
          where: { id: payment.orderId },
          data: { 
            paymentStatus: 'PAID',
            status: 'CONFIRMED'
          }
        })
      }
    }
    
    return apiResponse({ received: true })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Webhook validation error:', error.errors)
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Webhook error:', error)
    return apiError('Erro ao processar webhook', 500)
  }
}
