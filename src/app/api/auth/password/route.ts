
import { db } from '@/lib/db'
import { getUserFromRequest, hashPassword, verifyPassword, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres')
})

export async function PUT(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    const body = await request.json()
    const validatedData = changePasswordSchema.parse(body)
    
    // Verify current password
    const isValidPassword = await verifyPassword(validatedData.currentPassword, user.password)
    
    if (!isValidPassword) {
      return apiError('Senha atual incorreta', 400)
    }
    
    // Hash new password
    const hashedPassword = await hashPassword(validatedData.newPassword)
    
    // Update password
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })
    
    return apiResponse({
      message: 'Senha alterada com sucesso'
    })
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos', 400)
    }
    
    console.error('Change password error:', error)
    return apiError('Erro ao alterar senha', 500)
  }
}
