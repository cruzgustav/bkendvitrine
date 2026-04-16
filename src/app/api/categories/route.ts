import { db } from '@/lib/db'
import { getUserFromRequest, generateSlug, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const createCategorySchema = z.object({
  name: z.string().min(2, 'Nome da categoria deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  image: z.string().url('URL inválida').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida').optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional()
})

// Get categories for user's store
export async function GET(request: Request) {
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
    
    const categories = await db.category.findMany({
      where: { storeId: store.id },
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: { sortOrder: 'asc' }
    })
    
    return apiResponse({ categories })
    
  } catch (error) {
    console.error('Get categories error:', error)
    return apiError('Erro ao buscar categorias', 500)
  }
}

// Create category
export async function POST(request: Request) {
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
    const validatedData = createCategorySchema.parse(body)
    
    // Generate unique slug
    let slug = generateSlug(validatedData.name)
    let slugExists = await db.category.findFirst({
      where: { storeId: store.id, slug }
    })
    let counter = 1
    
    while (slugExists) {
      slug = `${generateSlug(validatedData.name)}-${counter}`
      slugExists = await db.category.findFirst({
        where: { storeId: store.id, slug }
      })
      counter++
    }
    
    // Get max sortOrder
    const maxSortOrder = await db.category.aggregate({
      where: { storeId: store.id },
      _max: { sortOrder: true }
    })
    
    const category = await db.category.create({
      data: {
        storeId: store.id,
        name: validatedData.name,
        slug,
        description: validatedData.description,
        image: validatedData.image,
        color: validatedData.color,
        icon: validatedData.icon,
        sortOrder: validatedData.sortOrder ?? (maxSortOrder._max.sortOrder ?? 0) + 1
      }
    })
    
    return apiResponse({
      message: 'Categoria criada com sucesso',
      category
    }, 201)
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Create category error:', error)
    return apiError('Erro ao criar categoria', 500)
  }
}
