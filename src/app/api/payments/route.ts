
import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const createPaymentSchema = z.object({
  orderId: z.string().optional(),
  subscriptionId: z.string().optional(),
  amount: z.number().positive('Valor deve ser positivo'),
  currency: z.string().default('BRL'),
  method: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO', 'BANK_TRANSFER']),
  // Credit card details (tokenized)
  cardToken: z.string().optional(),
  cardBrand: z.string().optional(),
  cardLast4: z.string().optional(),
  installments: z.number().int().min(1).max(12).optional()
})

// Get user's payments
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit
    
    const where: any = { userId: user.id }
    
    if (status) {
      where.status = status
    }
    
    const [payments, total] = await Promise.all([
      db.payment.findMany({
        where,
        include: {
          order: {
            select: {
              orderNumber: true,
              total: true
            }
          },
          subscription: {
            include: {
              plan: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.payment.count({ where })
    ])
    
    return apiResponse({
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
    
  } catch (error) {
    console.error('Get payments error:', error)
    return apiError('Erro ao buscar pagamentos', 500)
  }
}

// Create payment
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const body = await request.json()
    const validatedData = createPaymentSchema.parse(body)
    
    // Verify order or subscription belongs to user
    if (validatedData.orderId) {
      const order = await db.order.findFirst({
        where: { id: validatedData.orderId },
        include: { store: true }
      })
      
      if (!order || order.store.userId !== user.id) {
        return apiError('Pedido não encontrado', 404)
      }
    }
    
    if (validatedData.subscriptionId) {
      const subscription = await db.subscription.findFirst({
        where: { id: validatedData.subscriptionId, userId: user.id }
      })
      
      if (!subscription) {
        return apiError('Assinatura não encontrada', 404)
      }
    }
    
    // Create payment
    const payment = await db.payment.create({
      data: {
        userId: user.id,
        orderId: validatedData.orderId,
        subscriptionId: validatedData.subscriptionId,
        amount: validatedData.amount,
        currency: validatedData.currency,
        status: 'PENDING',
        method: validatedData.method,
        cardBrand: validatedData.cardBrand,
        cardLast4: validatedData.cardLast4,
        installments: validatedData.installments ?? 1
      }
    })
    
    // Simulate Infinity Pay integration
    // In production, this would call the actual Infinity Pay API
    const infinityPayResponse = await simulateInfinityPayIntegration(payment, validatedData)
    
    // Update payment with Infinity Pay data
    const updatedPayment = await db.payment.update({
      where: { id: payment.id },
      data: {
        infinityPayId: infinityPayResponse.infinityPayId,
        paymentIntentId: infinityPayResponse.paymentIntentId,
        pixQrCode: infinityPayResponse.pixQrCode,
        pixCode: infinityPayResponse.pixCode,
        pixExpiresAt: infinityPayResponse.pixExpiresAt,
        boletoUrl: infinityPayResponse.boletoUrl,
        boletoBarcode: infinityPayResponse.boletoBarcode,
        boletoExpiresAt: infinityPayResponse.boletoExpiresAt
      }
    })
    
    return apiResponse({
      message: 'Pagamento criado com sucesso',
      payment: updatedPayment,
      paymentInstructions: infinityPayResponse.instructions
    }, 201)
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Create payment error:', error)
    return apiError('Erro ao criar pagamento', 500)
  }
}

// Simulate Infinity Pay integration
async function simulateInfinityPayIntegration(
  payment: any,
  data: z.infer<typeof createPaymentSchema>
) {
  const infinityPayId = `INF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  const paymentIntentId = `PI-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
  
  const response: any = {
    infinityPayId,
    paymentIntentId
  }
  
  switch (data.method) {
    case 'PIX':
      // Generate PIX code
      response.pixQrCode = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`
      response.pixCode = `00020126580014br.gov.bcb.pix0136${infinityPayId}5204000053039865404${(payment.amount / 100).toFixed(2)}5802BR5925LOJA VIRTUAL SaaS EC6209SAO PAULO6304${Date.now().toString(16).toUpperCase()}`
      response.pixExpiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
      response.instructions = {
        title: 'Pagamento via PIX',
        qrCode: response.pixQrCode,
        pixCode: response.pixCode,
        expiresIn: '30 minutos'
      }
      break
      
    case 'BOLETO':
      // Generate Boleto
      response.boletoUrl = `https://infinitypay.com.br/boleto/${infinityPayId}`
      response.boletoBarcode = `23793.38128 60000.000000 0${infinityPayId.slice(-5)} 1 ${(payment.amount / 100).toString().padStart(10, '0')}`
      response.boletoExpiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
      response.instructions = {
        title: 'Pagamento via Boleto',
        boletoUrl: response.boletoUrl,
        barcode: response.boletoBarcode,
        expiresIn: '3 dias úteis'
      }
      break
      
    case 'CREDIT_CARD':
    case 'DEBIT_CARD':
      // For cards, we'd process immediately in production
      response.instructions = {
        title: 'Pagamento via Cartão',
        status: 'Processando',
        message: 'Aguarde a confirmação do pagamento'
      }
      break
      
    case 'BANK_TRANSFER':
      response.instructions = {
        title: 'Transferência Bancária',
        bankInfo: {
          bank: 'Banco Infinity Pay',
          agency: '0001',
          account: '12345678-9',
          accountType: 'Pagamento',
          identifier: infinityPayId
        }
      }
      break
  }
  
  return response
}
