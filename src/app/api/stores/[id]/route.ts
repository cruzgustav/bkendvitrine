export const revalidate = 0;
export const dynamic = 'force-dynamic';

import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const updateStoreSchema = z.object({
  name: z.string().min(2, 'Nome da loja deve ter pelo menos 2 caracteres').optional(),
  description: z.string().optional(),
  logo: z.string().url('URL inválida').optional().nullable(),
  banner: z.string().url('URL inválida').optional().nullable(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  twitter: z.string().optional(),
  tiktok: z.string().optional(),
  website: z.string().url('URL inválida').optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
  infinityPayClientId: z.string().optional(),
  infinityPayClientSecret: z.string().optional(),
})

// GET: ROTA PÚBLICA (Acessível pela Vitrine sem Token)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // 1. Busca os dados base da loja (Público)
    const store = await db.store.findFirst({
      where: {
        OR: [{ id }, { userId: id }, { slug: id }]
      },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' }
        },
        customization: true,
        settings: true,
        products: {
          where: { status: 'ACTIVE' },
          include: { 
            images: true,
            collections: true // <--- ADICIONADO: Agora o produto "sabe" a qual coleção pertence
          }
        }
      }
    })
    
    if (!store) return apiError('Loja não encontrada', 404)

    // 2. BUSCA DIRETA DE COLEÇÕES 
    const storeCollections = await db.collection.findMany({
      where: {
        storeId: store.id,
        isActive: true
      },
      include: {
        products: {
          where: { status: 'ACTIVE' },
          include: { images: true }
        }
      }
    });

    console.log(`[BACKEND VITRINE] Loja: ${store.name} | Coleções: ${storeCollections.length}`);
    
    // 3. Resposta formatada para o front-end
    return apiResponse({
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        description: store.description,
        logo: store.logo,
        banner: store.banner,
        email: store.email,
        phone: store.phone,
        whatsapp: store.whatsapp,
        instagram: store.instagram,
        facebook: store.facebook,
        twitter: store.twitter,
        tiktok: store.tiktok,
        website: store.website,
        address: store.address,
        city: store.city,
        state: store.state,
        zipCode: store.zipCode,
        country: store.country,
        currency: store.currency,
        isActive: store.isActive,
        customization: store.customization,
        categories: store.categories,
        products: store.products,
        collections: storeCollections || []
      }
    })
    
  } catch (error) {
    console.error('Get store error:', error)
    return apiError('Erro ao buscar dados da loja', 500)
  }
}

// PUT: ROTA PROTEGIDA
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request as any)
    if (!user) return unauthorizedError()
    
    const { id } = await params
    const store = await db.store.findUnique({
      where: { id, userId: user.id }
    })
    
    if (!store) return apiError('Não autorizado ou loja não encontrada', 404)
    
    const body = await request.json()
    const validatedData = updateStoreSchema.parse(body)
    
    const updatedStore = await db.store.update({
      where: { id },
      data: validatedData
    })
    
    return apiResponse({
      message: 'Loja atualizada com sucesso',
      store: updatedStore
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) return apiError('Dados inválidos', 400)
    console.error('Update store error:', error)
    return apiError('Erro ao atualizar loja', 500)
  }
}

// DELETE: ROTA PROTEGIDA
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request as any)
    if (!user) return unauthorizedError()
    
    const { id } = await params
    const store = await db.store.findUnique({
      where: { id, userId: user.id }
    })
    
    if (!store) return apiError('Loja não encontrada', 404)
    
    await db.store.update({
      where: { id },
      data: { isActive: false }
    })
    
    return apiResponse({
      message: 'Loja desativada com sucesso'
    })
    
  } catch (error) {
    console.error('Delete store error:', error)
    return apiError('Erro ao desativar loja', 500)
  }
}