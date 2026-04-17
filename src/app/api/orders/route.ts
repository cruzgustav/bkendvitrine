export const runtime = 'edge'

import { db } from '@/lib/db'
import { getUserFromRequest, generateOrderNumber, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().min(1)
  })).min(1, 'Pedido deve ter pelo menos um item'),
  customerEmail: z.string().email('Email inválido'),
  customerName: z.string().min(2, 'Nome é obrigatório').optional(),
  customerPhone: z.string().optional(),
  shippingAddress: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingZipCode: z.string().optional(),
  shippingCountry: z.string().optional(),
  billingAddress: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZipCode: z.string().optional(),
  billingCountry: z.string().optional(),
  notes: z.string().optional(),
  couponCode: z.string().optional()
})

// Get orders for user's store
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
    const paymentStatus = searchParams.get('paymentStatus')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit
    
    const where: any = { storeId: store.id }
    
    if (status) {
      where.status = status
    }
    
    if (paymentStatus) {
      where.paymentStatus = paymentStatus
    }
    
    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerEmail: { contains: search } }
      ]
    }
    
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                include: {
                  images: {
                    where: { isPrimary: true },
                    take: 1
                  }
                }
              },
              variant: true
            }
          },
          customer: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.order.count({ where })
    ])
    
    return apiResponse({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
    
  } catch (error) {
    console.error('Get orders error:', error)
    return apiError('Erro ao buscar pedidos', 500)
  }
}

// Create order
export async function POST(request: Request) {
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
    
    const body = await request.json()
    const validatedData = createOrderSchema.parse(body)
    
    // Validate products and calculate totals
    let subtotal = 0
    const orderItems: any[] = []
    
    for (const item of validatedData.items) {
      const product = await db.product.findFirst({
        where: { 
          id: item.productId, 
          storeId: store.id,
          status: 'ACTIVE'
        }
      })
      
      if (!product) {
        return apiError(`Produto ${item.productId} não encontrado`, 404)
      }
      
      let price = product.price
      let variantName = null
      
      if (item.variantId) {
        const variant = await db.productVariant.findFirst({
          where: { id: item.variantId, productId: product.id }
        })
        
        if (!variant) {
          return apiError(`Variante ${item.variantId} não encontrada`, 404)
        }
        
        if (variant.price) {
          price = variant.price
        }
        
        if (variant.quantity < item.quantity) {
          return apiError(`Estoque insuficiente para ${product.name}`, 400)
        }
        
        variantName = variant.name
      } else if (product.quantity < item.quantity) {
        return apiError(`Estoque insuficiente para ${product.name}`, 400)
      }
      
      const itemTotal = price * item.quantity
      subtotal += itemTotal
      
      orderItems.push({
        productId: product.id,
        variantId: item.variantId,
        productName: product.name,
        variantName,
        quantity: item.quantity,
        price,
        total: itemTotal
      })
    }
    
    // Apply coupon if provided
    let discount = 0
    if (validatedData.couponCode) {
      const coupon = await db.coupon.findFirst({
        where: {
          storeId: store.id,
          code: validatedData.couponCode,
          isActive: true
        }
      })
      
      if (coupon) {
        if (coupon.minPurchase && subtotal < coupon.minPurchase) {
          return apiError(`Cupom requer compra mínima de R$ ${(coupon.minPurchase / 100).toFixed(2)}`, 400)
        }
        
        if (coupon.type === 'PERCENTAGE') {
          discount = Math.round(subtotal * (coupon.value / 100))
        } else {
          discount = coupon.value
        }
        
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount
        }
      }
    }
    
    // Calculate shipping and tax
    const shipping = store.settings?.defaultShipping ?? 0
    const tax = store.settings?.taxEnabled 
      ? Math.round((subtotal - discount) * (store.settings.taxRate / 100))
      : 0
    
    const total = subtotal - discount + shipping + tax
    
    // Find or create customer
    let customer = await db.customer.findFirst({
      where: { storeId: store.id, email: validatedData.customerEmail }
    })
    
    if (!customer) {
      customer = await db.customer.create({
        data: {
          storeId: store.id,
          email: validatedData.customerEmail,
          name: validatedData.customerName,
          phone: validatedData.customerPhone
        }
      })
    }
    
    // Create order
    const order = await db.order.create({
      data: {
        storeId: store.id,
        customerId: customer.id,
        orderNumber: generateOrderNumber(),
        status: 'PENDING',
        paymentStatus: 'PENDING',
        subtotal,
        discount,
        shipping,
        tax,
        total,
        customerName: validatedData.customerName || customer.name,
        customerEmail: validatedData.customerEmail,
        customerPhone: validatedData.customerPhone || customer.phone,
        shippingAddress: validatedData.shippingAddress,
        shippingCity: validatedData.shippingCity,
        shippingState: validatedData.shippingState,
        shippingZipCode: validatedData.shippingZipCode,
        shippingCountry: validatedData.shippingCountry,
        billingAddress: validatedData.billingAddress,
        billingCity: validatedData.billingCity,
        billingState: validatedData.billingState,
        billingZipCode: validatedData.billingZipCode,
        billingCountry: validatedData.billingCountry,
        notes: validatedData.notes,
        items: {
          create: orderItems
        }
      },
      include: {
        items: {
          include: {
            product: true,
            variant: true
          }
        }
      }
    })
    
    // Update stock
    for (const item of validatedData.items) {
      if (item.variantId) {
        await db.productVariant.update({
          where: { id: item.variantId },
          data: { quantity: { decrement: item.quantity } }
        })
      } else {
        await db.product.update({
          where: { id: item.productId },
          data: { quantity: { decrement: item.quantity } }
        })
      }
    }
    
    // Update customer stats
    await db.customer.update({
      where: { id: customer.id },
      data: {
        totalOrders: { increment: 1 },
        totalSpent: { increment: total }
      }
    })
    
    return apiResponse({
      message: 'Pedido criado com sucesso',
      order
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
    
    console.error('Create order error:', error)
    return apiError('Erro ao criar pedido', 500)
  }
}
