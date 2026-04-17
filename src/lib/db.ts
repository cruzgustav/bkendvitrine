/**
 * Database access layer using Neon serverless driver directly.
 *
 * Prisma creates columns with EXACT field names from schema.prisma.
 * Since fields are camelCase (createdAt, userId, etc.), the DB columns
 * are also camelCase — NOT snake_case. Only TABLE names use @@map()
 * to map to snake_case (e.g., User → users).
 *
 * Therefore we do NOT convert column names between camelCase/snake_case.
 */
import { neon } from '@neondatabase/serverless'

// ── Connection ──────────────────────────────────────────────────────────
let _sql: any

function getSql() {
  if (!_sql) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Configure it in Cloudflare Dashboard or .env file.')
    }
    _sql = neon(connectionString)
  }
  return _sql
}

// ── CUID generator (replaces @default(cuid())) ─────────────────────────
function cuid(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  const extra = Math.random().toString(36).substring(2, 6)
  return `c${timestamp}${random}${extra}`
}

// ── Result normalization ────────────────────────────────────────────────
function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) return result
  if (result && typeof result === 'object') {
    if (Array.isArray(result.rows)) return result.rows
    if (Array.isArray(result.results)) return result.results
  }
  return []
}

// ── Convert $1/$2 parameterized SQL to tagged template literal call ────
function sqlToTemplateArgs(query: string, params: any[]): any[] {
  if (params.length === 0) {
    const strings = [query] as any as TemplateStringsArray
    ;(strings as any).raw = [query]
    return [strings]
  }
  const parts = query.split(/\$(\d+)/)
  const strings: string[] = []
  const orderedParams: any[] = []
  let currentString = parts[0]
  for (let i = 1; i < parts.length; i += 2) {
    const paramIndex = parseInt(parts[i], 10)
    strings.push(currentString)
    orderedParams.push(params[paramIndex - 1])
    currentString = parts[i + 1] || ''
  }
  strings.push(currentString)
  const templateStrings = strings as any as TemplateStringsArray
  ;(templateStrings as any).raw = [...strings]
  return [templateStrings, ...orderedParams]
}

// ── Safe query execution ────────────────────────────────────────────────
async function safeQuery(query: string, params: any[] = []): Promise<any[]> {
  const sql = getSql()
  try {
    const templateArgs = sqlToTemplateArgs(query, params)
    const raw = await sql(...templateArgs)
    return normalizeRows(raw)
  } catch (err: any) {
    console.error('[DB safeQuery] Failed:', query.slice(0, 200), '| Error:', err.message || String(err))
    throw err
  }
}

// ── Test connection ─────────────────────────────────────────────────────
export async function testConnection(): Promise<{ ok: boolean; details: Record<string, any> }> {
  const details: Record<string, any> = {
    dbUrlSet: !!process.env.DATABASE_URL,
    dbUrlPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 25) + '...' : 'NOT SET',
    nodeEnv: process.env.NODE_ENV,
  }
  try {
    const rows = await safeQuery('SELECT 1 as test')
    details.basicQuery = rows.length > 0
    const planRows = await safeQuery('SELECT COUNT(*)::int as count FROM plans')
    details.planCount = planRows.length > 0 ? (planRows[0] as any).count : -1
    return { ok: true, details }
  } catch (err: any) {
    details.error = err.message || String(err)
    return { ok: false, details }
  }
}

// ── Table mapping (model name → SQL table name via @@map) ──────────────
const TABLE_MAP: Record<string, string> = {
  user: 'users',
  store: 'stores',
  product: 'products',
  order: 'orders',
  category: 'categories',
  customer: 'customers',
  payment: 'payments',
  coupon: 'coupons',
  collection: 'collections',
  subscription: 'subscriptions',
  plan: 'plans',
  storeSetting: 'store_settings',
  storeCustomization: 'store_customizations',
  storeAnalytics: 'store_analytics',
  productImage: 'product_images',
  productVariant: 'product_variants',
  productReview: 'product_reviews',
  orderItem: 'order_items',
  systemSetting: 'system_settings',
}

// ── Tables that have createdAt column ───────────────────────────────────
const CREATED_AT_TABLES = new Set([
  'users', 'stores', 'products', 'orders', 'categories', 'customers',
  'payments', 'coupons', 'collections', 'subscriptions', 'plans',
  'store_settings', 'store_customizations', 'store_analytics',
  'product_images', 'product_variants', 'product_reviews',
  'order_items', 'system_settings',
])

// ── Tables that ALSO have updatedAt column ───────────────────────────────
// (Prisma @updatedAt — product_images, order_items, store_analytics only have createdAt)
const UPDATED_AT_TABLES = new Set([
  'users', 'stores', 'products', 'orders', 'categories', 'customers',
  'payments', 'coupons', 'collections', 'subscriptions', 'plans',
  'store_settings', 'store_customizations', 'product_variants',
  'product_reviews', 'system_settings',
])

// ── Default values (column names are camelCase — matching Prisma fields) ─
const DEFAULTS_MAP: Record<string, Record<string, any>> = {
  users: { role: 'USER' },
  stores: { country: 'Brasil', currency: 'BRL', timezone: 'America/Sao_Paulo', isActive: false, isVerified: false },
  products: { quantity: 0, lowStockThreshold: 5, status: 'DRAFT', isFeatured: false, isNew: false, isDigital: false },
  orders: { status: 'PENDING', paymentStatus: 'PENDING', discount: 0, shipping: 0, tax: 0 },
  categories: { sortOrder: 0, isActive: true },
  collections: { isActive: true },
  coupons: { usageCount: 0, isActive: true },
  customers: { totalOrders: 0, totalSpent: 0 },
  payments: { currency: 'BRL', status: 'PENDING', installments: 1 },
  subscriptions: { status: 'PENDING', billingCycle: 'MONTHLY', cancelAtPeriodEnd: false },
  store_settings: {
    emailNotifications: true, smsNotifications: false, orderConfirmation: true,
    orderShipped: true, orderDelivered: true, defaultShipping: 0,
    taxEnabled: false, taxRate: 0, taxIncluded: true, requireLogin: false,
    guestCheckout: true, acceptCreditCard: true, acceptPix: true, acceptBoleto: true,
  },
  store_customizations: {
    primaryColor: '#000000', secondaryColor: '#666666', accentColor: '#FF6B6B',
    backgroundColor: '#FFFFFF', textColor: '#333333', headingFont: 'Inter',
    bodyFont: 'Inter', layoutStyle: 'modern', productCardStyle: 'card',
    productsPerPage: 12, showBanner: true, showFeatured: true,
    showNewArrivals: true, showCategories: true, showReviews: true,
    showSalesCount: false,
  },
  product_images: { sortOrder: 0, isPrimary: false },
  product_variants: { quantity: 0 },
  product_reviews: { isVerified: false, isApproved: false, helpfulCount: 0 },
  store_analytics: { visitors: 0, pageViews: 0, orders: 0, revenue: 0, directTraffic: 0, organicTraffic: 0, socialTraffic: 0, referralTraffic: 0 },
}

// ── Apply defaults + timestamps for INSERTs ─────────────────────────────
function applyDefaults(data: Record<string, any>, table: string): Record<string, any> {
  const result = { ...data }

  // Table-specific defaults
  const defaults = DEFAULTS_MAP[table]
  if (defaults) {
    for (const [key, defaultVal] of Object.entries(defaults)) {
      if (!(key in result) || result[key] === undefined) {
        result[key] = defaultVal
      }
    }
  }

  // Timestamps (replaces Prisma @default(now()) and @updatedAt)
  const now = new Date().toISOString()
  if (CREATED_AT_TABLES.has(table)) {
    if (!('createdAt' in result) || result.createdAt === undefined) {
      result.createdAt = now
    }
  }
  if (UPDATED_AT_TABLES.has(table)) {
    if (!('updatedAt' in result) || result.updatedAt === undefined) {
      result.updatedAt = now
    }
  }

  return result
}

// ── WHERE clause builder (column names stay camelCase!) ─────────────────
function buildWhere(where: Record<string, any>, startIndex = 1): { sql: string; params: any[] } {
  const conditions: string[] = []
  const params: any[] = []
  let idx = startIndex

  for (const [key, value] of Object.entries(where)) {
    if (key === 'OR') {
      const orConditions: string[] = []
      for (const orClause of value as any[]) {
        const { sql: orSql, params: orParams } = buildWhere(orClause, idx)
        orConditions.push(`(${orSql})`)
        params.push(...orParams)
        idx += orParams.length
      }
      conditions.push(`(${orConditions.join(' OR ')})`)
      continue
    }
    if (key === 'AND') {
      const andConditions: string[] = []
      for (const andClause of value as any[]) {
        const { sql: andSql, params: andParams } = buildWhere(andClause, idx)
        andConditions.push(`(${andSql})`)
        params.push(...andParams)
        idx += andParams.length
      }
      conditions.push(`(${andConditions.join(' AND ')})`)
      continue
    }
    if (key === 'NOT') {
      // Prisma NOT: { id: "xxx" } → NOT (id = $1)
      const { sql: notSql, params: notParams } = buildWhere(value, idx)
      conditions.push(`NOT (${notSql})`)
      params.push(...notParams)
      idx += notParams.length
      continue
    }

    // Column name: use as-is (camelCase, matching Prisma field names)
    const col = `"${key}"`
    if (value === null) {
      conditions.push(`${col} IS NULL`)
    } else if (typeof value === 'object' && value !== null) {
      if ('in' in value) {
        const placeholders = (value.in as any[]).map(() => `$${idx++}`)
        conditions.push(`${col} IN (${placeholders.join(', ')})`)
        params.push(...value.in)
      } else if ('contains' in value) {
        conditions.push(`${col} ILIKE $${idx++}`)
        params.push(`%${value.contains}%`)
      } else if ('startsWith' in value) {
        conditions.push(`${col} ILIKE $${idx++}`)
        params.push(`${value.startsWith}%`)
      } else if ('gt' in value) {
        conditions.push(`${col} > $${idx++}`)
        params.push(value.gt)
      } else if ('gte' in value) {
        conditions.push(`${col} >= $${idx++}`)
        params.push(value.gte)
      } else if ('lt' in value) {
        conditions.push(`${col} < $${idx++}`)
        params.push(value.lt)
      } else if ('lte' in value) {
        conditions.push(`${col} <= $${idx++}`)
        params.push(value.lte)
      } else if ('not' in value) {
        if (value.not === null) {
          conditions.push(`${col} IS NOT NULL`)
        } else {
          conditions.push(`${col} != $${idx++}`)
          params.push(value.not)
        }
      }
    } else {
      conditions.push(`${col} = $${idx++}`)
      params.push(value)
    }
  }

  return { sql: conditions.join(' AND '), params }
}

// ── ORDER BY builder ────────────────────────────────────────────────────
function buildOrderBy(orderBy: Record<string, string> | Record<string, string>[]): string {
  if (Array.isArray(orderBy)) {
    return orderBy.map(o => {
      const [key, dir] = Object.entries(o)[0]
      return `"${key}" ${dir === 'asc' ? 'ASC' : 'DESC'}`
    }).join(', ')
  }
  const [key, dir] = Object.entries(orderBy)[0]
  return `"${key}" ${dir === 'asc' ? 'ASC' : 'DESC'}`
}

// ── Relations ───────────────────────────────────────────────────────────
// localFk:  FK column on the MAIN table (BelongsTo)  e.g. products.categoryId → categories.id
// remoteFk: FK column on the RELATED table (HasOne)   e.g. stores.userId → users.id
// fk:       FK column on the RELATED table (for 'many' includes + nested creates)
const RELATIONS: Record<string, Record<string, { table: string; fk?: string; localFk?: string; remoteFk?: string; type: 'one' | 'many' }>> = {
  users: {
    store: { table: 'stores', remoteFk: 'userId', fk: 'userId', type: 'one' },
  },
  stores: {
    user: { table: 'users', localFk: 'userId', type: 'one' },
    categories: { table: 'categories', fk: 'storeId', type: 'many' },
    products: { table: 'products', fk: 'storeId', type: 'many' },
    orders: { table: 'orders', fk: 'storeId', type: 'many' },
    customers: { table: 'customers', fk: 'storeId', type: 'many' },
    coupons: { table: 'coupons', fk: 'storeId', type: 'many' },
    collections: { table: 'collections', fk: 'storeId', type: 'many' },
    payments: { table: 'payments', fk: 'storeId', type: 'many' },
    subscriptions: { table: 'subscriptions', fk: 'userId', type: 'many' },
    customization: { table: 'store_customizations', remoteFk: 'storeId', fk: 'storeId', type: 'one' },
    settings: { table: 'store_settings', remoteFk: 'storeId', fk: 'storeId', type: 'one' },
    analytics: { table: 'store_analytics', fk: 'storeId', type: 'many' },
  },
  products: {
    store: { table: 'stores', localFk: 'storeId', type: 'one' },
    category: { table: 'categories', localFk: 'categoryId', type: 'one' },
    images: { table: 'product_images', fk: 'productId', type: 'many' },
    variants: { table: 'product_variants', fk: 'productId', type: 'many' },
    reviews: { table: 'product_reviews', fk: 'productId', type: 'many' },
    collections: { table: 'collections', fk: 'storeId', type: 'many' },
    orderItems: { table: 'order_items', fk: 'productId', type: 'many' },
  },
  orders: {
    store: { table: 'stores', localFk: 'storeId', type: 'one' },
    customer: { table: 'customers', localFk: 'customerId', type: 'one' },
    items: { table: 'order_items', fk: 'orderId', type: 'many' },
    payments: { table: 'payments', fk: 'orderId', type: 'many' },
  },
  order_items: {
    product: { table: 'products', localFk: 'productId', type: 'one' },
    variant: { table: 'product_variants', localFk: 'variantId', type: 'one' },
    order: { table: 'orders', localFk: 'orderId', type: 'one' },
  },
  payments: {
    order: { table: 'orders', localFk: 'orderId', type: 'one' },
    subscription: { table: 'subscriptions', localFk: 'subscriptionId', type: 'one' },
    user: { table: 'users', localFk: 'userId', type: 'one' },
  },
  subscriptions: {
    plan: { table: 'plans', localFk: 'planId', type: 'one' },
    user: { table: 'users', localFk: 'userId', type: 'one' },
    payments: { table: 'payments', fk: 'subscriptionId', type: 'many' },
  },
  customers: {
    store: { table: 'stores', localFk: 'storeId', type: 'one' },
    orders: { table: 'orders', fk: 'customerId', type: 'many' },
  },
  categories: {
    store: { table: 'stores', localFk: 'storeId', type: 'one' },
    products: { table: 'products', fk: 'categoryId', type: 'many' },
  },
  coupons: {
    store: { table: 'stores', localFk: 'storeId', type: 'one' },
  },
  collections: {
    store: { table: 'stores', localFk: 'storeId', type: 'one' },
    products: { table: 'products', fk: 'storeId', type: 'many' },
  },
  product_images: {
    product: { table: 'products', localFk: 'productId', type: 'one' },
  },
  product_variants: {
    product: { table: 'products', localFk: 'productId', type: 'one' },
  },
  plans: {
    subscriptions: { table: 'subscriptions', fk: 'planId', type: 'many' },
  },
}

// ── Include resolver ────────────────────────────────────────────────────
async function resolveIncludes(
  mainRows: Record<string, any>[],
  table: string,
  include: Record<string, any>
): Promise<void> {
  if (!mainRows.length) return

  const tableRelations = RELATIONS[table]

  for (const [relName, relInclude] of Object.entries(include)) {
    if (relName === '_count') {
      await resolveCount(mainRows, table, relInclude)
      continue
    }

    if (!tableRelations || !tableRelations[relName]) continue
    const rel = tableRelations[relName]
    const relTable = rel.table

    let orderBy: any = undefined
    let nestedInclude: any = undefined
    let whereFilter: any = undefined
    if (typeof relInclude === 'object' && relInclude !== null) {
      if (relInclude.orderBy) orderBy = relInclude.orderBy
      if (relInclude.include) nestedInclude = relInclude.include
      if (relInclude.where) whereFilter = relInclude.where
    }

    if (rel.type === 'one') {
      if (rel.remoteFk) {
        // HasOne: FK is on the RELATED table pointing back to main table
        // e.g. users.store → stores.userId points to users.id
        const ids = [...new Set(mainRows.map(r => r.id))]
        let query = `SELECT * FROM "${relTable}" WHERE "${rel.remoteFk}" = ANY($1)`
        const queryParams: any[] = [ids]
        // Apply where filter if present (e.g. customization: { where: { ... } })
        if (whereFilter) {
          const { sql: wSql, params: wParams } = buildWhere(whereFilter, queryParams.length + 1)
          query += ` AND (${wSql})`
          queryParams.push(...wParams)
        }
        if (orderBy) query += ` ORDER BY ${buildOrderBy(orderBy)}`
        const relRows = await safeQuery(query, queryParams)
        const relMap = new Map<string, Record<string, any>>()
        for (const row of relRows) {
          relMap.set((row as any)[rel.remoteFk!], row)
        }
        for (const mainRow of mainRows) {
          mainRow[relName] = relMap.get(mainRow.id) || null
        }
      } else {
        // BelongsTo: FK is on the MAIN table pointing to related table
        // e.g. products.category → products.categoryId points to categories.id
        const localFk = rel.localFk!
        const fkValues = [...new Set(mainRows.map(r => (r as any)[localFk]))].filter(Boolean)
        if (!fkValues.length) {
          for (const mainRow of mainRows) mainRow[relName] = null
          continue
        }
        let query = `SELECT * FROM "${relTable}" WHERE "id" = ANY($1)`
        const queryParams: any[] = [fkValues]
        if (whereFilter) {
          const { sql: wSql, params: wParams } = buildWhere(whereFilter, queryParams.length + 1)
          query += ` AND (${wSql})`
          queryParams.push(...wParams)
        }
        if (orderBy) query += ` ORDER BY ${buildOrderBy(orderBy)}`
        const relRows = await safeQuery(query, queryParams)
        const relMap = new Map<string, Record<string, any>>()
        for (const row of relRows) {
          relMap.set(row.id, row)
        }
        for (const mainRow of mainRows) {
          mainRow[relName] = relMap.get((mainRow as any)[localFk]) || null
        }
      }
      // Nested includes — use nestedInclude (extracted from relInclude.include) not the whole relInclude
      if (nestedInclude && typeof nestedInclude === 'object') {
        const nestedRows = mainRows.map(r => r[relName]).filter(Boolean)
        if (nestedRows.length) {
          await resolveIncludes(nestedRows, relTable, nestedInclude)
        }
      }
    } else {
      // One-to-many
      const ids = [...new Set(mainRows.map(r => r.id))]
      let query = `SELECT * FROM "${relTable}" WHERE "${rel.fk}" = ANY($1)`
      const queryParams: any[] = [ids]
      // Apply where filter if present (e.g. products: { where: { status: 'ACTIVE' } })
      if (whereFilter) {
        const { sql: wSql, params: wParams } = buildWhere(whereFilter, queryParams.length + 1)
        query += ` AND (${wSql})`
        queryParams.push(...wParams)
      }
      if (orderBy) query += ` ORDER BY ${buildOrderBy(orderBy)}`
      const relRows = await safeQuery(query, queryParams)
      const relMap = new Map<string, Record<string, any>[]>()
      for (const row of relRows) {
        const fkValue = (row as any)[rel.fk!]
        if (!relMap.has(fkValue)) relMap.set(fkValue, [])
        relMap.get(fkValue)!.push(row)
      }
      for (const mainRow of mainRows) {
        mainRow[relName] = relMap.get(mainRow.id) || []
      }
      // Nested includes — use nestedInclude (extracted from relInclude.include) not the whole relInclude
      if (nestedInclude && typeof nestedInclude === 'object') {
        const allNestedRows = mainRows.flatMap(r => r[relName] || [])
        if (allNestedRows.length) {
          await resolveIncludes(allNestedRows, relTable, nestedInclude)
        }
      }
    }
  }
}

// Resolve _count includes
async function resolveCount(
  mainRows: Record<string, any>[],
  table: string,
  countSpec: boolean | Record<string, boolean>
): Promise<void> {
  if (!mainRows.length) return
  const tableRelations = RELATIONS[table]
  if (!tableRelations) return

  if (countSpec === true) {
    for (const [relName, rel] of Object.entries(tableRelations)) {
      if (rel.type !== 'many' || !rel.fk) continue
      const ids = [...new Set(mainRows.map(r => r.id))]
      const rows = await safeQuery(
        `SELECT "${rel.fk}" as fk, COUNT(*)::int as count FROM "${rel.table}" WHERE "${rel.fk}" = ANY($1) GROUP BY "${rel.fk}"`,
        [ids]
      )
      const countMap = new Map<string, number>()
      for (const row of rows) { countMap.set((row as any).fk, (row as any).count) }
      for (const mainRow of mainRows) {
        if (!mainRow._count) mainRow._count = {}
        mainRow._count[relName] = countMap.get(mainRow.id) || 0
      }
    }
  } else if (typeof countSpec === 'object') {
    for (const [relName, shouldCount] of Object.entries(countSpec)) {
      if (!shouldCount) continue
      const rel = tableRelations[relName]
      if (!rel || rel.type !== 'many' || !rel.fk) continue
      const ids = [...new Set(mainRows.map(r => r.id))]
      const rows = await safeQuery(
        `SELECT "${rel.fk}" as fk, COUNT(*)::int as count FROM "${rel.table}" WHERE "${rel.fk}" = ANY($1) GROUP BY "${rel.fk}"`,
        [ids]
      )
      const countMap = new Map<string, number>()
      for (const row of rows) { countMap.set((row as any).fk, (row as any).count) }
      for (const mainRow of mainRows) {
        if (!mainRow._count) mainRow._count = {}
        mainRow._count[relName] = countMap.get(mainRow.id) || 0
      }
    }
  }
}

// ── Repository (provides Prisma-like API per model) ─────────────────────
function createRepo(model: string) {
  const table = TABLE_MAP[model]
  if (!table) throw new Error(`Unknown model: ${model}`)

  return {
    findUnique: async (args: { where: Record<string, any>; include?: Record<string, any> }) => {
      const { sql: whereSql, params } = buildWhere(args.where)
      const rows = await safeQuery(`SELECT * FROM "${table}" WHERE ${whereSql} LIMIT 1`, params)
      if (!rows.length) return null
      const row = rows[0] as Record<string, any>
      if (args.include) await resolveIncludes([row], table, args.include)
      return row
    },

    findFirst: async (args: { where?: Record<string, any>; include?: Record<string, any>; orderBy?: any }) => {
      const parts: string[] = [`SELECT * FROM "${table}"`]
      const params: any[] = []
      if (args.where && Object.keys(args.where).length > 0) {
        const { sql: whereSql, params: whereParams } = buildWhere(args.where)
        parts.push(`WHERE ${whereSql}`)
        params.push(...whereParams)
      }
      if (args.orderBy) parts.push(`ORDER BY ${buildOrderBy(args.orderBy)}`)
      parts.push('LIMIT 1')
      const rows = await safeQuery(parts.join(' '), params)
      if (!rows.length) return null
      const row = rows[0] as Record<string, any>
      if (args.include) await resolveIncludes([row], table, args.include)
      return row
    },

    findMany: async (args: { where?: Record<string, any>; include?: Record<string, any>; orderBy?: any; take?: number; skip?: number }) => {
      const parts: string[] = [`SELECT * FROM "${table}"`]
      const params: any[] = []
      let paramIdx = 1
      if (args.where && Object.keys(args.where).length > 0) {
        const { sql: whereSql, params: whereParams } = buildWhere(args.where, paramIdx)
        parts.push(`WHERE ${whereSql}`)
        params.push(...whereParams)
        paramIdx += whereParams.length
      }
      if (args.orderBy) parts.push(`ORDER BY ${buildOrderBy(args.orderBy)}`)
      if (args.take !== undefined) { parts.push(`LIMIT $${paramIdx++}`); params.push(args.take) }
      if (args.skip !== undefined) { parts.push(`OFFSET $${paramIdx++}`); params.push(args.skip) }
      const rows = await safeQuery(parts.join(' '), params)
      const result = rows as Record<string, any>[]
      if (args.include) await resolveIncludes(result, table, args.include)
      return result
    },

    create: async (args: { data: Record<string, any>; include?: Record<string, any> }) => {
      // Handle nested creates (e.g., store: { create: { ... } })
      const nestedCreates: Array<{ relName: string; table: string; fk: string; data: Record<string, any> | any[] }> = []
      const cleanData: Record<string, any> = {}

      for (const [key, value] of Object.entries(args.data)) {
        // Skip undefined values (e.g., images: undefined from product create)
        if (value === undefined) continue

        if (value && typeof value === 'object' && !Array.isArray(value) && value.create) {
          // Nested create: { images: { create: [...] } }
          const relInfo = RELATIONS[table]?.[key]
          if (relInfo) {
            // FK on the nested/related table that points back to the main record
            // For 'many': fk is the FK on the nested table (e.g., product_images.productId)
            // For 'one':  fk or remoteFk is the FK on the nested table (e.g., stores.userId)
            const nestedFk = relInfo.fk || relInfo.remoteFk || ''
            nestedCreates.push({
              relName: key,
              table: relInfo.table,
              fk: nestedFk,
              data: value.create,
            })
          }
        } else {
          cleanData[key] = value
        }
      }

      // Generate ID if not provided
      if (!cleanData.id) cleanData.id = cuid()

      // Apply defaults + timestamps
      const dataWithDefaults = applyDefaults(cleanData, table)

      // Remove any remaining undefined values
      const finalData: Record<string, any> = {}
      for (const [key, value] of Object.entries(dataWithDefaults)) {
        if (value !== undefined) finalData[key] = value
      }

      const cols = Object.keys(finalData)
      const vals = Object.values(finalData)
      const placeholders = vals.map((_, i) => `$${i + 1}`)

      const rows = await safeQuery(
        `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        vals
      )
      if (!rows.length) throw new Error(`Failed to create ${model}: no rows returned`)
      const row = rows[0] as Record<string, any>

      // Execute nested creates
      for (const nested of nestedCreates) {
        const items = Array.isArray(nested.data) ? nested.data : [nested.data]
        const nestedResults: Record<string, any>[] = []

        for (const item of items) {
          const nestedData: Record<string, any> = { ...item }
          if (!nestedData.id) nestedData.id = cuid()
          nestedData[nested.fk] = row.id
          const nestedWithDefaults = applyDefaults(nestedData, nested.table)

          // Remove undefined values
          const nestedFinal: Record<string, any> = {}
          for (const [key, value] of Object.entries(nestedWithDefaults)) {
            if (value !== undefined) nestedFinal[key] = value
          }

          const nestedCols = Object.keys(nestedFinal)
          const nestedVals = Object.values(nestedFinal)
          const nestedPlaceholders = nestedVals.map((_, i) => `$${i + 1}`)
          const nestedRows = await safeQuery(
            `INSERT INTO "${nested.table}" (${nestedCols.map(c => `"${c}"`).join(', ')}) VALUES (${nestedPlaceholders.join(', ')}) RETURNING *`,
            nestedVals
          )
          if (nestedRows.length) nestedResults.push(nestedRows[0] as Record<string, any>)
        }

        // Attach results: array for one-to-many, single object for one-to-one
        const relInfo = RELATIONS[table]?.[nested.relName]
        if (relInfo) {
          row[nested.relName] = relInfo.type === 'many' ? nestedResults : (nestedResults[0] || null)
        }
      }

      if (args.include) await resolveIncludes([row], table, args.include)
      return row
    },

    update: async (args: { where: Record<string, any>; data: Record<string, any>; include?: Record<string, any> }) => {
      const { sql: whereSql, params: whereParams } = buildWhere(args.where)
      const setParts: string[] = []
      const setParams: any[] = []
      let paramIdx = 1

      // Filter out undefined values from update data
      const cleanData: Record<string, any> = {}
      for (const [key, value] of Object.entries(args.data)) {
        if (value !== undefined) cleanData[key] = value
      }

      for (const [key, value] of Object.entries(cleanData)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if ('decrement' in value) {
            setParts.push(`"${key}" = "${key}" - $${paramIdx++}`)
            setParams.push(value.decrement)
          } else if ('increment' in value) {
            setParts.push(`"${key}" = "${key}" + $${paramIdx++}`)
            setParams.push(value.increment)
          } else if ('push' in value) {
            setParts.push(`"${key}" = COALESCE("${key}"::jsonb, '[]'::jsonb) || $${paramIdx++}::jsonb`)
            setParams.push(JSON.stringify(value.push))
          }
        } else {
          setParts.push(`"${key}" = $${paramIdx++}`)
          setParams.push(value)
        }
      }

      // Always update updatedAt (replaces Prisma @updatedAt)
      if (UPDATED_AT_TABLES.has(table)) {
        setParts.push(`"updatedAt" = NOW()`)
      }

      const allParams = [...setParams, ...whereParams]
      const rows = await safeQuery(
        `UPDATE "${table}" SET ${setParts.join(', ')} WHERE ${whereSql} RETURNING *`,
        allParams
      )
      if (!rows.length) return null
      const row = rows[0] as Record<string, any>
      if (args.include) await resolveIncludes([row], table, args.include)
      return row
    },

    delete: async (args: { where: Record<string, any> }) => {
      const { sql: whereSql, params } = buildWhere(args.where)
      const rows = await safeQuery(`DELETE FROM "${table}" WHERE ${whereSql} RETURNING *`, params)
      if (!rows.length) return null
      return rows[0] as Record<string, any>
    },

    deleteMany: async (args: { where: Record<string, any> }) => {
      const { sql: whereSql, params } = buildWhere(args.where)
      const rows = await safeQuery(`DELETE FROM "${table}" WHERE ${whereSql} RETURNING *`, params)
      return { count: rows.length }
    },

    updateMany: async (args: { where: Record<string, any>; data: Record<string, any> }) => {
      const { sql: whereSql, params: whereParams } = buildWhere(args.where)
      const setParts: string[] = []
      const setParams: any[] = []
      let paramIdx = 1
      for (const [key, value] of Object.entries(args.data)) {
        setParts.push(`"${key}" = $${paramIdx++}`)
        setParams.push(value)
      }
      if (UPDATED_AT_TABLES.has(table)) setParts.push(`"updatedAt" = NOW()`)
      const allParams = [...setParams, ...whereParams]
      const rows = await safeQuery(
        `UPDATE "${table}" SET ${setParts.join(', ')} WHERE ${whereSql} RETURNING *`,
        allParams
      )
      return { count: rows.length }
    },

    count: async (args?: { where?: Record<string, any> }) => {
      const parts: string[] = [`SELECT COUNT(*)::int as count FROM "${table}"`]
      const params: any[] = []
      if (args?.where && Object.keys(args.where).length > 0) {
        const { sql: whereSql, params: whereParams } = buildWhere(args.where)
        parts.push(`WHERE ${whereSql}`)
        params.push(...whereParams)
      }
      const rows = await safeQuery(parts.join(' '), params)
      return (rows[0] as any)?.count ?? 0
    },

    aggregate: async (args: { where?: Record<string, any>; _max?: Record<string, boolean>; _sum?: Record<string, boolean>; _avg?: Record<string, boolean>; _min?: Record<string, boolean>; _count?: boolean | Record<string, boolean> }) => {
      const selects: string[] = []
      const params: any[] = []
      if (args._max) for (const col of Object.keys(args._max)) selects.push(`MAX("${col}") as "max_${col}"`)
      if (args._sum) for (const col of Object.keys(args._sum)) selects.push(`SUM("${col}") as "sum_${col}"`)
      if (args._min) for (const col of Object.keys(args._min)) selects.push(`MIN("${col}") as "min_${col}"`)
      if (args._avg) for (const col of Object.keys(args._avg)) selects.push(`AVG("${col}") as "avg_${col}"`)
      if (args._count === true) selects.push('COUNT(*)::int as "_count_all"')
      else if (typeof args._count === 'object') for (const col of Object.keys(args._count)) selects.push(`COUNT("${col}")::int as "_count_${col}"`)
      const parts: string[] = [`SELECT ${selects.join(', ')} FROM "${table}"`]
      if (args.where && Object.keys(args.where).length > 0) {
        const { sql: whereSql, params: whereParams } = buildWhere(args.where)
        parts.push(`WHERE ${whereSql}`)
        params.push(...whereParams)
      }
      const rows = await safeQuery(parts.join(' '), params)
      const row = rows[0] as Record<string, any>
      const result: Record<string, any> = {}
      for (const [key, value] of Object.entries(row)) {
        if (key.startsWith('max_')) { if (!result._max) result._max = {}; result._max[key.replace('max_', '')] = value }
        else if (key.startsWith('sum_')) { if (!result._sum) result._sum = {}; result._sum[key.replace('sum_', '')] = value }
        else if (key.startsWith('min_')) { if (!result._min) result._min = {}; result._min[key.replace('min_', '')] = value }
        else if (key.startsWith('avg_')) { if (!result._avg) result._avg = {}; result._avg[key.replace('avg_', '')] = value }
        else if (key.startsWith('_count_')) { if (!result._count) result._count = {} as any; (result._count as any)[key.replace('_count_', '')] = value }
        else if (key === '_count_all') { result._count = value }
      }
      return result
    },

    upsert: async (args: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any>; include?: Record<string, any> }) => {
      const { sql: whereSql, params: whereParams } = buildWhere(args.where)
      const existing = await safeQuery(`SELECT * FROM "${table}" WHERE ${whereSql} LIMIT 1`, whereParams)
      if (existing.length > 0) {
        const setParts: string[] = []
        const setParams: any[] = []
        let paramIdx = 1
        for (const [key, value] of Object.entries(args.update)) {
          setParts.push(`"${key}" = $${paramIdx++}`)
          setParams.push(value)
        }
        if (UPDATED_AT_TABLES.has(table)) setParts.push(`"updatedAt" = NOW()`)
        const allParams = [...setParams, ...whereParams]
        const rows = await safeQuery(`UPDATE "${table}" SET ${setParts.join(', ')} WHERE ${whereSql} RETURNING *`, allParams)
        const row = rows[0] as Record<string, any>
        if (args.include) await resolveIncludes([row], table, args.include)
        return row
      } else {
        const data = { ...args.create }
        if (!data.id) data.id = cuid()
        const dataWithDefaults = applyDefaults(data, table)
        const cols = Object.keys(dataWithDefaults)
        const vals = Object.values(dataWithDefaults)
        const placeholders = vals.map((_, i) => `$${i + 1}`)
        const rows = await safeQuery(
          `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
          vals
        )
        const row = rows[0] as Record<string, any>
        if (args.include) await resolveIncludes([row], table, args.include)
        return row
      }
    },

    createMany: async (args: { data: Record<string, any>[] }) => {
      let count = 0
      for (const item of args.data) {
        const data = { ...item }
        if (!data.id) data.id = cuid()
        const dataWithDefaults = applyDefaults(data, table)
        const cols = Object.keys(dataWithDefaults)
        const vals = Object.values(dataWithDefaults)
        const placeholders = vals.map((_, i) => `$${i + 1}`)
        await safeQuery(
          `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`,
          vals
        )
        count++
      }
      return { count }
    },
  }
}

// ── Export db proxy ─────────────────────────────────────────────────────
export const db = new Proxy({} as any, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== 'string') return undefined
    if (prop === '$transaction') {
      return async (promises: Promise<any>[]) => {
        const results = []
        for (const promise of promises) {
          results.push(await promise)
        }
        return results
      }
    }
    if (prop === '$queryRaw') {
      return {
        unsafe: async (query: string, params?: any[]) => {
          return safeQuery(query, params || [])
        }
      }
    }
    return createRepo(prop)
  }
})
