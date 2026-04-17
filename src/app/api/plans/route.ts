
import { db } from '@/lib/db'
import { apiResponse, apiError } from '@/lib/auth'

// Get all active plans (public)
export async function GET() {
  try {
    const plans = await db.plan.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' }
    })
    
    // Parse features JSON
    const plansWithFeatures = plans.map(plan => ({
      ...plan,
      features: plan.features ? JSON.parse(plan.features) : []
    }))
    
    return apiResponse({ plans: plansWithFeatures })
    
  } catch (error) {
    console.error('Get plans error:', error)
    return apiError('Erro ao buscar planos', 500)
  }
}
