
import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const updateCustomizationSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  headingFont: z.string().optional(),
  bodyFont: z.string().optional(),
  layoutStyle: z.string().optional(),
  productCardStyle: z.string().optional(),
  productsPerPage: z.number().int().min(6).max(48).optional(),
  showBanner: z.boolean().optional(),
  bannerTitle: z.string().optional(),
  bannerSubtitle: z.string().optional(),
  showFeatured: z.boolean().optional(),
  showNewArrivals: z.boolean().optional(),
  showCategories: z.boolean().optional(),
  customCss: z.string().optional(),
  customJs: z.string().optional(),
  showReviews: z.boolean().optional(),
  showSalesCount: z.boolean().optional()
})

// Get store customization
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const store = await db.store.findUnique({
      where: { userId: user.id },
      include: { customization: true }
    })
    
    if (!store) {
      return apiError('Loja não encontrada', 404)
    }
    
    return apiResponse({ customization: store.customization })
    
  } catch (error) {
    console.error('Get customization error:', error)
    return apiError('Erro ao buscar personalização', 500)
  }
}

// Update store customization
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
    const validatedData = updateCustomizationSchema.parse(body)
    
    const customization = await db.storeCustomization.upsert({
      where: { storeId: store.id },
      update: validatedData,
      create: {
        storeId: store.id,
        ...validatedData
      }
    })
    
    return apiResponse({
      message: 'Personalização atualizada com sucesso',
      customization
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Update customization error:', error)
    return apiError('Erro ao atualizar personalização', 500)
  }
}
