import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

// Schema tolerante: aceita URL ou string vazia (que vira undefined)
const updateStoreSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  description: z.string().optional(),
  slug: z.string().optional(),
  logo: z.string().url().or(z.literal("")).optional().nullable(),
  banner: z.string().url().or(z.literal("")).optional().nullable(),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  twitter: z.string().optional(),
  tiktok: z.string().optional(),
  website: z.string().url().or(z.literal("")).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  infinityPayClientId: z.string().optional(),
  infinityPayClientSecret: z.string().optional(),
})

// GET: Busca os dados da loja para o dono logado
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) return unauthorizedError()
    
    const store = await db.store.findUnique({
      where: { userId: user.id },
      include: {
        categories: { orderBy: { sortOrder: 'asc' } },
        customization: true,
        settings: true,
        _count: {
          select: { products: true, orders: true, customers: true }
        }
      }
    })
    
    if (!store) return apiError('Loja não encontrada', 404)
    
    return apiResponse({ store })
    
  } catch (error) {
    console.error('Get store error:', error)
    return apiError('Erro ao buscar loja', 500)
  }
}

// PUT: Atualiza as configurações (Logo, Pagamentos, Banner, etc)
export async function PUT(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    if (!user) return unauthorizedError()
    
    const body = await request.json()

    // Filtro para não validar strings vazias como URLs inválidas
    const cleanData: any = {}
    for (const [key, value] of Object.entries(body)) {
      if (value !== "" && value !== null) {
        cleanData[key] = value
      }
    }

    const validatedData = updateStoreSchema.parse(cleanData)
    
    const store = await db.store.findUnique({
      where: { userId: user.id }
    })
    
    if (!store) return apiError('Loja não encontrada', 404)

    // Tratamento de Slug (Link da vitrine)
    if (validatedData.slug) {
      validatedData.slug = validatedData.slug
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-z0-9]+/g, '-')     // Remove caracteres especiais
        .replace(/(^-|-$)+/g, '');      // Remove traços no início/fim
        
      const slugExists = await db.store.findFirst({
        where: { 
          slug: validatedData.slug,
          id: { not: store.id } 
        }
      })
      if (slugExists) return apiError('Este link já está em uso', 400)
    }

    const updatedStore = await db.store.update({
      where: { id: store.id },
      data: validatedData
    })
    
    return apiResponse({
      message: 'Configurações atualizadas com sucesso',
      store: updatedStore
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Erro de validação Zod:", error.errors)
      return apiError('Dados inválidos', 400, error.errors)
    }
    console.error('Update store error:', error)
    return apiError('Erro ao salvar configurações', 500)
  }
}

// CORS preflight é tratado pelo middleware.ts global