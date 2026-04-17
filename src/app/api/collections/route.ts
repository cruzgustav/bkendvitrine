
import { db } from '@/lib/db'
import { getUserFromRequest, apiResponse, apiError, unauthorizedError } from '@/lib/auth'
import { z } from 'zod'

// Schema para validar a criação/edição de coleções
const collectionSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  slug: z.string().min(2, 'O slug é obrigatório'),
  description: z.string().optional(),
  image: z.string().url('URL da imagem inválida').optional().nullable(),
  isActive: z.boolean().optional().default(true),
  productIds: z.array(z.string()).optional(), // IDs dos produtos para vincular à coleção
})

// GET: Listar todas as coleções da loja do utilizador (Admin)
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    if (!user) return unauthorizedError()

    const store = await db.store.findUnique({
      where: { userId: user.id }
    })

    if (!store) return apiError('Loja não encontrada', 404)

    const collections = await db.collection.findMany({
      where: { storeId: store.id },
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return apiResponse(collections)
  } catch (error) {
    console.error('List collections error:', error)
    return apiError('Erro ao listar coleções', 500)
  }
}

// POST: Criar uma nova coleção
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request as any)
    if (!user) return unauthorizedError()

    // LOG PARA DEBUG: Verificar o ID do usuário logado
    console.log("POST Collections: Criando para o usuário", user.id)

    const store = await db.store.findUnique({
      where: { userId: user.id }
    })

    if (!store) {
      console.error("POST Collections ERROR: Loja não encontrada para este usuário")
      return apiError('Loja não encontrada', 404)
    }

    // LOG PARA DEBUG: Verificar o ID da loja encontrada
    console.log("POST Collections: Loja encontrada ID ->", store.id)

    const body = await request.json()
    const { name, slug, description, image, isActive, productIds } = collectionSchema.parse(body)

    // Verifica se o slug já existe para esta loja
    const existingCollection = await db.collection.findUnique({
      where: {
        storeId_slug: {
          storeId: store.id,
          slug: slug
        }
      }
    })

    if (existingCollection) {
      return apiError('Já existe uma coleção com este slug', 400)
    }

    const collection = await db.collection.create({
      data: {
        name,
        slug,
        description,
        image,
        isActive,
        storeId: store.id, // VÍNCULO OBRIGATÓRIO
        // Faz a ligação muitos-para-muitos com os produtos enviados
        products: {
          connect: productIds?.map(id => ({ id })) || []
        }
      },
      include: {
        products: true
      }
    })

    console.log("POST Collections: Sucesso! Coleção criada com ID da loja.")
    return apiResponse(collection)

  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError('Dados inválidos: ' + error.errors[0].message, 400)
    }
    console.error('Create collection error:', error)
    return apiError('Erro ao criar coleção', 500)
  }
}