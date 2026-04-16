import { db } from '@/lib/db'
import { getUserFromRequest, generateSlug, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const createProductSchema = z.object({
  categoryId: z.string().optional(),
  sku: z.string().optional(),
  name: z.string().min(2, 'Nome do produto deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.number().positive('Preço deve ser positivo'),
  comparePrice: z.number().positive('Preço de comparação deve ser positivo').optional(),
  costPrice: z.number().positive('Preço de custo deve ser positivo').optional(),
  quantity: z.number().int().min(0, 'Quantidade não pode ser negativa').optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  weight: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  length: z.number().positive().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  barcode: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isDigital: z.boolean().optional(),
  digitalFile: z.string().url().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    isPrimary: z.boolean().optional()
  })).optional(),
  variants: z.array(z.object({
    name: z.string(),
    sku: z.string().optional(),
    price: z.number().optional(),
    quantity: z.number().int().min(0).optional(),
    options: z.any().optional()
  })).optional()
})

// Get products for user's store
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
    
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit
    
    const where: any = { storeId: store.id }
    
    if (status) {
      where.status = status
    }
    
    if (categoryId) {
      where.categoryId = categoryId
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { sku: { contains: search } }
      ]
    }
    
    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: {
          category: true,
          images: {
            orderBy: { sortOrder: 'asc' }
          },
          variants: true,
          _count: {
            select: { orderItems: true, reviews: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.product.count({ where })
    ])
    
    return apiResponse({
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
    
  } catch (error) {
    console.error('Get products error:', error)
    return apiError('Erro ao buscar produtos', 500)
  }
}

// Create product
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
    const validatedData = createProductSchema.parse(body)
    
    // Generate unique slug
    let slug = generateSlug(validatedData.name)
    let slugExists = await db.product.findFirst({
      where: { storeId: store.id, slug }
    })
    let counter = 1
    
    while (slugExists) {
      slug = `${generateSlug(validatedData.name)}-${counter}`
      slugExists = await db.product.findFirst({
        where: { storeId: store.id, slug }
      })
      counter++
    }
    
    const { images, variants, tags, ...productData } = validatedData
    
    // Create product with images and variants
    const product = await db.product.create({
      data: {
        storeId: store.id,
        ...productData,
        tags: tags ? JSON.stringify(tags) : null,
        slug,
        images: images ? {
          create: images.map((img, index) => ({
            url: img.url,
            alt: img.alt,
            isPrimary: img.isPrimary ?? index === 0,
            sortOrder: index
          }))
        } : undefined,
        variants: variants ? {
          create: variants.map(v => ({
            name: v.name,
            sku: v.sku,
            price: v.price,
            quantity: v.quantity ?? 0,
            options: JSON.stringify(v.options)
          }))
        } : undefined
      },
      include: {
        category: true,
        images: true,
        variants: true
      }
    })
    
    return apiResponse({
      message: 'Produto criado com sucesso',
      product
    }, 201)
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string[]> = {}
      error.errors.forEach(err => {
        const field = err.path.join('.')
        if (!errors[field]) errors[field] = []
        errors[field].push(err.message)
      })
      return apiError('Dados inválidos', 400, errors)
    }
    
    console.error('Create product error:', error)
    return apiError('Erro ao criar produto', 500)
  }
}
