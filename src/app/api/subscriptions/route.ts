export const runtime = 'edge'

import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const createSubscriptionSchema = z.object({
  planId: z.string(),
  billingCycle: z.enum(['MONTHLY', 'YEARLY'])
})

// Get user's subscription
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const subscription = await db.subscription.findFirst({
      where: { userId: user.id },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return apiResponse({ subscription })
    
  } catch (error) {
    console.error('Get subscription error:', error)
    return apiError('Erro ao buscar assinatura', 500)
  }
}

// Create subscription
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const body = await request.json()
    const validatedData = createSubscriptionSchema.parse(body)
    
    // Check if plan exists
    const plan = await db.plan.findUnique({
      where: { id: validatedData.planId }
    })
    
    if (!plan) {
      return apiError('Plano não encontrado', 404)
    }
    
    // Check if user already has an active subscription
    const existingSubscription = await db.subscription.findFirst({
      where: {
        userId: user.id,
        status: { in: ['ACTIVE', 'TRIAL', 'PENDING'] }
      }
    })
    
    if (existingSubscription) {
      return apiError('Você já possui uma assinatura ativa', 400)
    }
    
    // Calculate period dates
    const now = new Date()
    const periodEnd = new Date(now)
    
    if (validatedData.billingCycle === 'MONTHLY') {
      periodEnd.setMonth(periodEnd.getMonth() + 1)
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1)
    }
    
    // Create subscription
    const subscription = await db.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        billingCycle: validatedData.billingCycle,
        status: 'PENDING',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd
      },
      include: {
        plan: true
      }
    })
    
    // Create initial payment
    const amount = validatedData.billingCycle === 'MONTHLY' 
      ? plan.priceMonthly 
      : plan.priceYearly
    
    const payment = await db.payment.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        amount,
        currency: 'BRL',
        status: 'PENDING',
        method: 'PIX' // Default to PIX for initial payment
      }
    })
    
    return apiResponse({
      message: 'Assinatura criada. Aguarde o pagamento.',
      subscription,
      payment
    }, 201)
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Create subscription error:', error)
    return apiError('Erro ao criar assinatura', 500)
  }
}
