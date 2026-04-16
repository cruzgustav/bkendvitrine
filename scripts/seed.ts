#!/usr/bin/env bun

/**
 * Seed Script - Initialize system data
 * Run this once to create initial plans and settings
 * 
 * Usage:
 *   bun run scripts/seed.ts
 */

import { db } from '../src/lib/db'

async function main() {
  console.log('🌱 Starting seed...')
  
  // Check if plans already exist
  const existingPlans = await db.plan.count()
  
  if (existingPlans > 0) {
    console.log(`✅ Plans already exist (${existingPlans} plans found)`)
    return
  }
  
  // Create plans
  console.log('Creating subscription plans...')
  
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
  
  console.log(`✅ Created ${plans.length} plans:`)
  plans.forEach(p => {
    console.log(`   - ${p.name}: R$ ${(p.priceMonthly / 100).toFixed(2)}/mês ou R$ ${(p.priceYearly / 100).toFixed(2)}/ano`)
  })
  
  // Create system settings
  console.log('Creating system settings...')
  
  const settingsData = [
    { key: 'infinity_pay_api_key', value: '', description: 'Infinity Pay API Key' },
    { key: 'infinity_pay_secret', value: '', description: 'Infinity Pay Secret Key' },
    { key: 'infinity_pay_webhook_secret', value: '', description: 'Infinity Pay Webhook Secret' },
    { key: 'default_currency', value: 'BRL', description: 'Default currency' },
    { key: 'default_timezone', value: 'America/Sao_Paulo', description: 'Default timezone' },
    { key: 'platform_name', value: 'SaaS E-commerce', description: 'Platform name' },
    { key: 'platform_email', value: 'contato@saasecommerce.com.br', description: 'Platform contact email' }
  ]
  
  for (const setting of settingsData) {
    const existing = await db.systemSetting.findUnique({ where: { key: setting.key } })
    if (!existing) {
      await db.systemSetting.create({ data: setting })
    }
  }
  
  console.log('✅ System settings created')
  console.log('🌱 Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
