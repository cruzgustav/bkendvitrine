
import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const updateSettingsSchema = z.object({
  businessHours: z.string().optional(),
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  orderConfirmation: z.boolean().optional(),
  orderShipped: z.boolean().optional(),
  orderDelivered: z.boolean().optional(),
  freeShippingMin: z.number().positive().nullable().optional(),
  defaultShipping: z.number().min(0).optional(),
  taxEnabled: z.boolean().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  taxIncluded: z.boolean().optional(),
  requireLogin: z.boolean().optional(),
  guestCheckout: z.boolean().optional(),
  minOrderAmount: z.number().positive().nullable().optional(),
  acceptCreditCard: z.boolean().optional(),
  acceptPix: z.boolean().optional(),
  acceptBoleto: z.boolean().optional(),
  termsUrl: z.string().url().nullable().optional(),
  privacyUrl: z.string().url().nullable().optional(),
  refundPolicy: z.string().optional()
})

// Get store settings
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const store = await db.store.findUnique({
      where: { userId: user.id },
      include: { settings: true }
    })
    
    if (!store) {
      return apiError('Loja não encontrada', 404)
    }
    
    return apiResponse({ settings: store.settings })
    
  } catch (error) {
    console.error('Get settings error:', error)
    return apiError('Erro ao buscar configurações', 500)
  }
}

// Update store settings
export async function PUT(request: Request) {
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
    const validatedData = updateSettingsSchema.parse(body)
    
    const settings = await db.storeSetting.upsert({
      where: { storeId: store.id },
      update: validatedData,
      create: {
        storeId: store.id,
        ...validatedData
      }
    })
    
    return apiResponse({
      message: 'Configurações atualizadas com sucesso',
      settings
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Update settings error:', error)
    return apiError('Erro ao atualizar configurações', 500)
  }
}
