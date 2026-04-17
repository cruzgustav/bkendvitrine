
import { db } from '@/lib/db'
import { apiResponse, apiError } from '@/lib/auth'
import { z } from 'zod'

// 1. Validamos tudo que vem do Astro (Vitrine)
const checkoutSchema = z.object({
  storeId: z.string(),
  items: z.array(z.object({
    productId: z.string(),
    variantId: z.string().optional(),
    quantity: z.number().int().min(1)
  })).min(1, 'Carrinho vazio'),
  customer: z.object({
    name: z.string().min(2, 'Nome é obrigatório'),
    email: z.string().email('Email inválido'),
    document: z.string().min(11, 'CPF/CNPJ inválido'), 
    phone: z.string().optional(),
  }),
  shipping: z.object({
    address: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string().default('Brasil'),
  }),
  paymentMethod: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD', 'WHATSAPP']),
  cardToken: z.string().optional() 
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = checkoutSchema.parse(body)

    // 2. Busca a loja
    const store = await db.store.findUnique({
      where: { id: validatedData.storeId }
    })

    if (!store) return apiError('Loja não encontrada', 404)
    
    // NOTA: Vamos usar o campo infinityPayClientId do seu banco para armazenar a Handle (ex: "de-bruna-s88")
    const hasInfinityPay = Boolean(store.infinityPayClientId)

    // 3. Calcula o total buscando os preços REAIS no banco de dados (Segurança)
    let subtotal = 0
    const orderItemsData: any[] = []

    for (const item of validatedData.items) {
      const product = await db.product.findFirst({
        where: { id: item.productId, storeId: store.id, status: 'ACTIVE' }
      })
      
      if (!product) return apiError(`Produto indisponível`, 404)

      let price = product.price
      let variantName: string | null = null

      if (item.variantId) {
        const variant = await db.productVariant.findFirst({
          where: { id: item.variantId, productId: product.id }
        })
        if (!variant) return apiError(`Variação indisponível`, 404)
        if (variant.price) price = variant.price
        if (variant.quantity < item.quantity) return apiError(`Estoque insuficiente`, 400)
        variantName = variant.name
      } else {
        if (product.quantity < item.quantity) return apiError(`Estoque insuficiente`, 400)
      }

      const itemTotal = price * item.quantity
      subtotal += itemTotal

      orderItemsData.push({
        productId: product.id,
        variantId: item.variantId,
        productName: product.name,
        variantName,
        quantity: item.quantity,
        price,
        total: itemTotal
      })
    }

    const total = subtotal 

    // 4. Cria ou atualiza o Cliente
    let customer = await db.customer.findFirst({
      where: { storeId: store.id, email: validatedData.customer.email }
    })

    if (!customer) {
      customer = await db.customer.create({
        data: {
          storeId: store.id,
          email: validatedData.customer.email,
          name: validatedData.customer.name,
          document: validatedData.customer.document,
          phone: validatedData.customer.phone
        }
      })
    } else {
      await db.customer.update({
        where: { id: customer.id },
        data: { document: validatedData.customer.document, name: validatedData.customer.name }
      })
    }

    // 5. Cria o Pedido no Banco
    const orderNumber = `PED-${Date.now().toString().slice(-6)}`
    
    const order = await db.order.create({
      data: {
        storeId: store.id,
        customerId: customer.id,
        orderNumber,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentMethod: validatedData.paymentMethod as any, 
        subtotal,
        total,
        customerName: validatedData.customer.name,
        customerEmail: validatedData.customer.email,
        customerDocument: validatedData.customer.document,
        customerPhone: validatedData.customer.phone,
        shippingAddress: validatedData.shipping.address,
        shippingCity: validatedData.shipping.city,
        shippingState: validatedData.shipping.state,
        shippingZipCode: validatedData.shipping.zipCode,
        shippingCountry: validatedData.shipping.country,
        items: { create: orderItemsData }
      }
    })

    // 6. CHAMA A INFINITY PAY OU MANDA PRO WHATSAPP
    if (hasInfinityPay && validatedData.paymentMethod !== 'WHATSAPP') {
      
      // ===== FLUXO COM INFINITY PAY =====
      const paymentResult = await processInfinitePay(
        store.infinityPayClientId!, // Aqui deve estar a Handle ("de-bruna-s88")
        order,
        validatedData,
        orderItemsData // Passamos os itens formatados para enviar pra InfinitePay
      )

      await db.payment.create({
        data: {
          userId: store.userId,
          orderId: order.id,
          amount: total,
          method: validatedData.paymentMethod as any, 
          status: 'PENDING',
          // O link de checkout não devolve Pix Code na hora, o cliente paga na tela deles
        }
      })

      // Baixa o estoque
      for (const item of validatedData.items) {
        if (item.variantId) {
          await db.productVariant.update({ where: { id: item.variantId }, data: { quantity: { decrement: item.quantity } } })
        } else {
          await db.product.update({ where: { id: item.productId }, data: { quantity: { decrement: item.quantity } } })
        }
      }

      return apiResponse({
        message: 'Redirecionando para pagamento...',
        action: 'REDIRECT_CHECKOUT', 
        orderId: order.id,
        checkoutUrl: paymentResult.url // Mandamos a URL da InfinitePay para o front-end
      }, 201)

    } else {
      // ===== FLUXO DO WHATSAPP =====
      for (const item of validatedData.items) {
        if (item.variantId) {
          await db.productVariant.update({ where: { id: item.variantId }, data: { quantity: { decrement: item.quantity } } })
        } else {
          await db.product.update({ where: { id: item.productId }, data: { quantity: { decrement: item.quantity } } })
        }
      }

      return apiResponse({
        message: 'Pedido gerado. Finalizar no WhatsApp.',
        action: 'WHATSAPP_REDIRECT', 
        orderId: order.id,
        whatsappNumber: store.whatsapp || store.phone || '', 
        orderNumber: order.orderNumber,
        total: total
      }, 201)
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      const zodError = error as z.ZodError; 
      const errors: Record<string, string[]> = {}
      
      zodError.errors.forEach(err => {
        const field = err.path.join('.')
        if (!errors[field]) errors[field] = []
        errors[field].push(err.message)
      })
      
      return apiError('Dados do checkout inválidos', 400, errors)
    }
    
    console.error('Checkout error:', error)
    return apiError('Erro ao processar checkout', 500)
  }
}

// ==========================================
// NOVA INTEGRAÇÃO COM A INFINITE PAY (CHECKOUT LINKS)
// ==========================================
async function processInfinitePay(handle: string, order: any, data: any, orderItemsData: any[]) {
  
  // 1. Prepara os itens no formato exigido (preço em centavos e descrição limitada)
  const infiniteItems = orderItemsData.map(item => ({
    description: (item.variantName ? `${item.productName} - ${item.variantName}` : item.productName).substring(0, 100),
    quantity: item.quantity,
    price: Math.round(Number(item.price) * 100)
  }))

  // 2. Tratamento rigoroso de Telefone (Precisa de 55 + DDD + Numero, apenas dígitos)
  let rawPhone = data.customer.phone ? data.customer.phone.replace(/\D/g, '') : '';
  if (rawPhone.length > 0 && !rawPhone.startsWith('55')) {
    rawPhone = `55${rawPhone}`;
  }

  // 3. Monta o payload final
  const payload = {
    origin: "external_checkout",
    handle: handle, 
    order_nsu: order.id, 
    items: infiniteItems,
    customer: {
      name: data.customer.name.trim(),
      document_number: data.customer.document.replace(/\D/g, ''),
      email: data.customer.email.trim(),
      phone_number: rawPhone 
    },
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4321'}/sucesso`, 
  }

  // 4. Faz a requisição para gerar o link
  const chargeResponse = await fetch('https://api.infinitepay.io/invoices/public/checkout/links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const resultData = await chargeResponse.json()

  if (!chargeResponse.ok) {
    console.error('Erro detalhado da InfinitePay:', JSON.stringify(resultData, null, 2));
    throw new Error(resultData.message || 'Falha ao gerar link na InfinitePay.');
  }

  return resultData;
}