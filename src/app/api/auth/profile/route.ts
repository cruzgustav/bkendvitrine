export const runtime = 'edge'

import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  phone: z.string().optional(),
  avatar: z.string().url('URL inválida').optional().nullable()
})

export async function PUT(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const body = await request.json()
    const validatedData = updateProfileSchema.parse(body)
    
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: validatedData
    })
    
    return apiResponse({
      message: 'Perfil atualizado com sucesso',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        avatar: updatedUser.avatar,
        role: updatedUser.role
      }
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Update profile error:', error)
    return apiError('Erro ao atualizar perfil', 500)
  }
}
