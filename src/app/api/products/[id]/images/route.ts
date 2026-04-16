import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const addImageSchema = z.object({
  url: z.string().url('URL inválida'),
  alt: z.string().optional(),
  isPrimary: z.boolean().optional()
})

// Get product images
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
      where: { id, storeId: store.id }
    })
    
    if (!product) {
      return apiError('Produto não encontrado', 404)
    }
    
    const images = await db.productImage.findMany({
      where: { productId: id },
      orderBy: { sortOrder: 'asc' }
    })
    
    return apiResponse({ images })
    
  } catch (error) {
    console.error('Get images error:', error)
    return apiError('Erro ao buscar imagens', 500)
  }
}

// Add image to product
export async function POST(
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
      include: { images: true }
    })
    
    if (!product) {
      return apiError('Produto não encontrado', 404)
    }
    
    const body = await request.json()
    const validatedData = addImageSchema.parse(body)
    
    // Get max sort order
    const maxSortOrder = product.images.length > 0
      ? Math.max(...product.images.map(img => img.sortOrder))
      : -1
    
    // If this is the first image or marked as primary, unset other primary images
    if (validatedData.isPrimary || product.images.length === 0) {
      await db.productImage.updateMany({
        where: { productId: id, isPrimary: true },
        data: { isPrimary: false }
      })
    }
    
    const image = await db.productImage.create({
      data: {
        productId: id,
        url: validatedData.url,
        alt: validatedData.alt,
        isPrimary: validatedData.isPrimary ?? product.images.length === 0,
        sortOrder: maxSortOrder + 1
      }
    })
    
    return apiResponse({
      message: 'Imagem adicionada com sucesso',
      image
    }, 201)
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Add image error:', error)
    return apiError('Erro ao adicionar imagem', 500)
  }
}

// Update image order or delete
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
    const { images } = z.object({
      images: z.array(z.object({
        id: z.string(),
        sortOrder: z.number().int().optional(),
        isPrimary: z.boolean().optional(),
        alt: z.string().optional()
      }))
    }).parse(body)
    
    // Update images in transaction
    await db.$transaction(
      images.map(img => 
        db.productImage.update({
          where: { id: img.id, productId: id },
          data: {
            sortOrder: img.sortOrder,
            isPrimary: img.isPrimary,
            alt: img.alt
          }
        })
      )
    )
    
    return apiResponse({
      message: 'Imagens atualizadas com sucesso'
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Update images error:', error)
    return apiError('Erro ao atualizar imagens', 500)
  }
}

// Delete image
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
    
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')
    
    if (!imageId) {
      return apiError('ID da imagem é obrigatório', 400)
    }
    
    const image = await db.productImage.findFirst({
      where: { id: imageId, productId: id }
    })
    
    if (!image) {
      return apiError('Imagem não encontrada', 404)
    }
    
    await db.productImage.delete({
      where: { id: imageId }
    })
    
    // If deleted image was primary, set next image as primary
    if (image.isPrimary) {
      const nextImage = await db.productImage.findFirst({
        where: { productId: id },
        orderBy: { sortOrder: 'asc' }
      })
      
      if (nextImage) {
        await db.productImage.update({
          where: { id: nextImage.id },
          data: { isPrimary: true }
        })
      }
    }
    
    return apiResponse({
      message: 'Imagem excluída com sucesso'
    })
    
  } catch (error) {
    console.error('Delete image error:', error)
    return apiError('Erro ao excluir imagem', 500)
  }
}
