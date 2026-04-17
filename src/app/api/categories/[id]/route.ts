
import { db } from '@/lib/db'
import { getUserFromRequest, generateSlug, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const updateCategorySchema = z.object({
  name: z.string().min(2, 'Nome da categoria deve ter pelo menos 2 caracteres').optional(),
  description: z.string().optional(),
  image: z.string().url('URL inválida').optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida').optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional()
})

// Get category by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    const { id } = await params
    
    const category = await db.category.findFirst({
      where: { id, storeId: store.id },
      include: {
        products: {
          where: { status: 'ACTIVE' },
          take: 10
        },
        _count: {
          select: { products: true }
        }
      }
    })
    
    if (!category) {
      return apiError('Categoria não encontrada', 404)
    }
    
    return apiResponse({ category })
    
  } catch (error) {
    console.error('Get category error:', error)
    return apiError('Erro ao buscar categoria', 500)
  }
}

// Update category
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    const { id } = await params
    
    const category = await db.category.findFirst({
      where: { id, storeId: store.id }
    })
    
    if (!category) {
      return apiError('Categoria não encontrada', 404)
    }
    
    const body = await request.json()
    const validatedData = updateCategorySchema.parse(body)
    
    // Update slug if name changed
    let slug = category.slug
    if (validatedData.name && validatedData.name !== category.name) {
      slug = generateSlug(validatedData.name)
      let slugExists = await db.category.findFirst({
        where: { storeId: store.id, slug, NOT: { id } }
      })
      let counter = 1
      
      while (slugExists) {
        slug = `${generateSlug(validatedData.name)}-${counter}`
        slugExists = await db.category.findFirst({
          where: { storeId: store.id, slug, NOT: { id } }
        })
        counter++
      }
    }
    
    const updatedCategory = await db.category.update({
      where: { id },
      data: {
        ...validatedData,
        slug
      }
    })
    
    return apiResponse({
      message: 'Categoria atualizada com sucesso',
      category: updatedCategory
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Update category error:', error)
    return apiError('Erro ao atualizar categoria', 500)
  }
}

// Delete category
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    
    const { id } = await params
    
    const category = await db.category.findFirst({
      where: { id, storeId: store.id }
    })
    
    if (!category) {
      return apiError('Categoria não encontrada', 404)
    }
    
    // Check if category has products
    const productsCount = await db.product.count({
      where: { categoryId: id }
    })
    
    if (productsCount > 0) {
      return apiError('Não é possível excluir uma categoria com produtos. Mova os produtos primeiro.', 400)
    }
    
    await db.category.delete({
      where: { id }
    })
    
    return apiResponse({
      message: 'Categoria excluída com sucesso'
    })
    
  } catch (error) {
    console.error('Delete category error:', error)
    return apiError('Erro ao excluir categoria', 500)
  }
}
