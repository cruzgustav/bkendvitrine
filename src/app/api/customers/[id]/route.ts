
import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const updateCustomerSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional()
})

// Get customer by ID
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
    
    const customer = await db.customer.findFirst({
      where: { id, storeId: store.id },
      include: {
        orders: {
          include: {
            items: {
              include: {
                product: {
                  include: {
                    images: { where: { isPrimary: true }, take: 1 }
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        _count: {
          select: { orders: true }
        }
      }
    })
    
    if (!customer) {
      return apiError('Cliente não encontrado', 404)
    }
    
    return apiResponse({ customer })
    
  } catch (error) {
    console.error('Get customer error:', error)
    return apiError('Erro ao buscar cliente', 500)
  }
}

// Update customer
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
    
    const customer = await db.customer.findFirst({
      where: { id, storeId: store.id }
    })
    
    if (!customer) {
      return apiError('Cliente não encontrado', 404)
    }
    
    const body = await request.json()
    const validatedData = updateCustomerSchema.parse(body)
    
    const updatedCustomer = await db.customer.update({
      where: { id },
      data: validatedData
    })
    
    return apiResponse({
      message: 'Cliente atualizado com sucesso',
      customer: updatedCustomer
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Update customer error:', error)
    return apiError('Erro ao atualizar cliente', 500)
  }
}

// Delete customer
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
    
    const customer = await db.customer.findFirst({
      where: { id, storeId: store.id }
    })
    
    if (!customer) {
      return apiError('Cliente não encontrado', 404)
    }
    
    // Check if customer has orders
    const ordersCount = await db.order.count({
      where: { customerId: id }
    })
    
    if (ordersCount > 0) {
      return apiError('Não é possível excluir um cliente com pedidos', 400)
    }
    
    await db.customer.delete({
      where: { id }
    })
    
    return apiResponse({
      message: 'Cliente excluído com sucesso'
    })
    
  } catch (error) {
    console.error('Delete customer error:', error)
    return apiError('Erro ao excluir cliente', 500)
  }
}
