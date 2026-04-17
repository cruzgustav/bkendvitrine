export const runtime = 'edge'

import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const updateCollectionSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().optional(),
  description: z.string().optional(),
  image: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
  productIds: z.array(z.string()).optional(), // Lista de IDs para atualizar os produtos
})

// PUT: Editar uma coleção específica
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request as any)
    if (!user) return unauthorizedError()

    const { id } = await params
    const body = await request.json()
    const validatedData = updateCollectionSchema.parse(body)

    // Garantir que a coleção pertence à loja do utilizador logado
    const collection = await db.collection.findFirst({
      where: { 
        id, 
        store: { userId: user.id } 
      }
    })

    if (!collection) return apiError('Coleção não encontrada ou sem permissão', 404)

    const { productIds, ...data } = validatedData

    const updated = await db.collection.update({
      where: { id },
      data: {
        ...data,
        products: productIds ? {
          set: productIds.map(productId => ({ id: productId }))
        } : undefined
      },
      include: {
        _count: { select: { products: true } }
      }
    })

    return apiResponse(updated)
  } catch (error) {
    if (error instanceof z.ZodError) return apiError('Dados inválidos', 400)
    console.error('Update collection error:', error)
    return apiError('Erro ao atualizar coleção', 500)
  }
}

// DELETE: Remover uma coleção
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request as any)
    if (!user) return unauthorizedError()

    const { id } = await params

    // Apenas apaga se a coleção for do utilizador
    const collection = await db.collection.findFirst({
      where: { id, store: { userId: user.id } }
    })

    if (!collection) return apiError('Coleção não encontrada', 404)

    await db.collection.delete({
      where: { id }
    })

    return apiResponse({ message: 'Coleção eliminada com sucesso' })
  } catch (error) {
    console.error('Delete collection error:', error)
    return apiError('Erro ao eliminar coleção', 500)
  }
}