import { db } from '@/lib/db'
import { getUserFromRequest, generateSlug, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const updateProductSchema = z.object({
  categoryId: z.string().nullable().optional(),
  sku: z.string().optional(),
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.number().positive().optional(),
  comparePrice: z.number().positive().nullable().optional(),
  costPrice: z.number().positive().nullable().optional(),
  quantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  weight: z.number().positive().nullable().optional(),
  width: z.number().positive().nullable().optional(),
  height: z.number().positive().nullable().optional(),
  length: z.number().positive().nullable().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  barcode: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED']).optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isDigital: z.boolean().optional(),
  digitalFile: z.string().url().nullable().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional()
})

// Get product by ID
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
    
    const product = await db.product.findFirst({
      where: { id, storeId: store.id },
      include: {
        category: true,
        images: {
          orderBy: { sortOrder: 'asc' }
        },
        variants: true,
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: { orderItems: true, reviews: true }
        }
      }
    })
    
    if (!product) {
      return apiError('Produto não encontrado', 404)
    }
    
    return apiResponse({ product })
    
  } catch (error) {
    console.error('Get product error:', error)
    return apiError('Erro ao buscar produto', 500)
  }
}

// Update product
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
    
    const product = await db.product.findFirst({
      where: { id, storeId: store.id }
    })
    
    if (!product) {
      return apiError('Produto não encontrado', 404)
    }
    
    const body = await request.json()
    const validatedData = updateProductSchema.parse(body)
    
    // Update slug if name changed
    let slug = product.slug
    if (validatedData.name && validatedData.name !== product.name) {
      slug = generateSlug(validatedData.name)
      let slugExists = await db.product.findFirst({
        where: { storeId: store.id, slug, NOT: { id } }
      })
      let counter = 1
      
      while (slugExists) {
        slug = `${generateSlug(validatedData.name)}-${counter}`
        slugExists = await db.product.findFirst({
          where: { storeId: store.id, slug, NOT: { id } }
        })
        counter++
      }
    }
    
    const { tags, ...restData } = validatedData
    
    const updatedProduct = await db.product.update({
      where: { id },
      data: {
        ...restData,
        tags: tags ? JSON.stringify(tags) : undefined,
        slug
      },
      include: {
        category: true,
        images: true,
        variants: true
      }
    })
    
    return apiResponse({
      message: 'Produto atualizado com sucesso',
      product: updatedProduct
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Update product error:', error)
    return apiError('Erro ao atualizar produto', 500)
  }
}

// Delete product
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
    
    const product = await db.product.findFirst({
      where: { id, storeId: store.id }
    })
    
    if (!product) {
      return apiError('Produto não encontrado', 404)
    }
    
    // Check if product has orders
    const ordersCount = await db.orderItem.count({
      where: { productId: id }
    })
    
    if (ordersCount > 0) {
      // Soft delete - mark as discontinued
      await db.product.update({
        where: { id },
        data: { status: 'DISCONTINUED' }
      })
      
      return apiResponse({
        message: 'Produto marcado como descontinuado (possui pedidos vinculados)'
      })
    }
    
    // Hard delete if no orders
    await db.product.delete({
      where: { id }
    })
    
    return apiResponse({
      message: 'Produto excluído com sucesso'
    })
    
  } catch (error) {
    console.error('Delete product error:', error)
    return apiError('Erro ao excluir produto', 500)
  }
}
