import { db } from '@/lib/db'
import { apiResponse, apiError } from '@/lib/auth'

// Seed initial data (plans)
export async function POST(request: Request) {
  try {
    // Check authorization (in production, this should be protected)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.SEED_SECRET || 'seed-secret-2024'}`) {
      return apiError('Não autorizado', 401)
    }
    
    // Check if plans already exist
    const existingPlans = await db.plan.count()
    
    if (existingPlans > 0) {
      return apiResponse({
        message: 'Dados já foram inicializados',
        existingPlans
      })
    }
    
    // Create plans
    const plans = await Promise.all([
      db.plan.create({
        data: {
          name: 'Starter',
          slug: 'starter',
          description: 'Perfeito para começar sua loja virtual',
          priceMonthly: 4900, // R$ 49.00
          priceYearly: 47000, // R$ 470.00 (2 meses grátis)
          maxProducts: 50,
          maxCategories: 10,
          maxOrders: 500,
          maxStorageMb: 500,
          customDomain: false,
          analytics: false,
          priority: 1,
          features: JSON.stringify([
            'Até 50 produtos',
            'Até 10 categorias',
            'Até 500 pedidos/mês',
            '500MB de armazenamento',
            'Suporte por email',
            'Relatórios básicos',
            'Integração com Infinity Pay'
          ])
        }
      }),
      db.plan.create({
        data: {
          name: 'Professional',
          slug: 'professional',
          description: 'Para lojas em crescimento',
          priceMonthly: 9900, // R$ 99.00
          priceYearly: 95000, // R$ 950.00 (2 meses grátis)
          maxProducts: 500,
          maxCategories: 50,
          maxOrders: 5000,
          maxStorageMb: 2000,
          customDomain: true,
          analytics: true,
          priority: 2,
          features: JSON.stringify([
            'Até 500 produtos',
            'Até 50 categorias',
            'Até 5.000 pedidos/mês',
            '2GB de armazenamento',
            'Domínio personalizado',
            'Analytics avançado',
            'Suporte prioritário',
            'Cupons de desconto',
            'Múltiplas formas de pagamento',
            'Integração com Infinity Pay'
          ])
        }
      }),
      db.plan.create({
        data: {
          name: 'Enterprise',
          slug: 'enterprise',
          description: 'Para grandes operações',
          priceMonthly: 29900, // R$ 299.00
          priceYearly: 287000, // R$ 2.870.00 (2 meses grátis)
          maxProducts: -1, // Unlimited
          maxCategories: -1,
          maxOrders: -1,
          maxStorageMb: 10000,
          customDomain: true,
          analytics: true,
          priority: 3,
          features: JSON.stringify([
            'Produtos ilimitados',
            'Categorias ilimitadas',
            'Pedidos ilimitados',
            '10GB de armazenamento',
            'Domínio personalizado',
            'Analytics avançado',
            'Suporte 24/7 prioritário',
            'API dedicada',
            'Múltiplos usuários',
            'Integrações avançadas',
            'Relatórios personalizados',
            'Integração com Infinity Pay'
          ])
        }
      })
    ])
    
    // Create system settings
    await db.systemSetting.createMany({
      data: [
        { key: 'infinity_pay_api_key', value: '', description: 'Infinity Pay API Key' },
        { key: 'infinity_pay_secret', value: '', description: 'Infinity Pay Secret Key' },
        { key: 'infinity_pay_webhook_secret', value: '', description: 'Infinity Pay Webhook Secret' },
        { key: 'default_currency', value: 'BRL', description: 'Default currency' },
        { key: 'default_timezone', value: 'America/Sao_Paulo', description: 'Default timezone' }
      ],
      skipDuplicates: true
    })
    
    return apiResponse({
      message: 'Dados inicializados com sucesso',
      plans: plans.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        priceMonthly: p.priceMonthly / 100,
        priceYearly: p.priceYearly / 100
      }))
    })
    
  } catch (error) {
    console.error('Seed error:', error)
    return apiError('Erro ao inicializar dados', 500)
  }
}
