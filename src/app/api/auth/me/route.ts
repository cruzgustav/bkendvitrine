export const runtime = 'edge'

import { getUserFromRequest, apiResponse, unauthorizedError } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    
    if (!user) {
      return unauthorizedError()
    }
    
    return apiResponse({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      }
    })
    
  } catch (error) {
    console.error('Get profile error:', error)
    return unauthorizedError()
  }
}
