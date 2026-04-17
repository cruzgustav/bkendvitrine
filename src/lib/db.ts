/**
 * Database access layer using Neon serverless driver directly.
 *
 * WHY NOT PRISMA?
 * Prisma Client internally calls `fs.readdir` to discover its query engine binary.
 * Cloudflare Workers has no filesystem → `[unenv] fs.readdir is not implemented yet!`.
 * The `/edge` import doesn't support driver adapters either.
 * So we bypass Prisma entirely and use raw SQL via the Neon HTTP driver.
 *
 * WHY NOT sql.unsafe()?
 * On Cloudflare Workers, `sql.unsafe(query, params)` returns a descriptor object
 * like {"sql":"SELECT ..."} instead of executing the query. The primary API
 * (tagged template literals) works correctly.
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
    const nextText = parts[i + 1] || ''
    strings.push(currentString)
    orderedParams.push(params[paramIndex - 1])
    currentString = nextText
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

// ── Test connection (for diagnostics) ───────────────────────────────────
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

// ── Table mapping (model name → SQL table name) ────────────────────────
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

// ── Primary key column for each table ───────────────────────────────────
const PK_MAP: Record<string, string> = {
  users: 'id',
  stores: 'id',
  products: 'id',
  orders: 'id',
  categories: 'id',
  customers: 'id',
  payments: 'id',
  coupons: 'id',
  collections: 'id',
  subscriptions: 'id',
  plans: 'id',
  store_settings: 'id',
  store_customizations: 'id',
  store_analytics: 'id',
  product_images: 'id',
  product_variants: 'id',
  product_reviews: 'id',
  order_items: 'id',
  system_settings: 'id',
}

// ── Unique constraints (for findUnique on non-PK fields) ────────────────
const UNIQUE_MAP: Record<string, Record<string, string>> = {
  users: { email: 'email' },
  stores: { userId: 'user_id', slug: 'slug' },
  plans: { slug: 'slug' },
  categories: { storeId_slug: 'store_id, slug' },
  products: { storeId_slug: 'store_id, slug' },
  coupons: { storeId_code: 'store_id, code' },
  customers: { storeId_email: 'store_id, email' },
  collections: { storeId_slug: 'store_id, slug' },
  store_settings: { storeId: 'store_id' },
  store_customizations: { storeId: 'store_id' },
  store_analytics: { storeId_date: 'store_id, date' },
  system_settings: { key: 'key' },
}

// ── Default values for columns (replaces Prisma @default()) ─────────────
const DEFAULTS_MAP: Record<string, Record<string, any>> = {
  users: { role: 'USER' },
  stores: { country: 'Brasil', currency: 'BRL', timezone: 'America/Sao_Paulo', is_active: false, is_verified: false },
  products: { quantity: 0, low_stock_threshold: 5, status: 'DRAFT', is_featured: false, is_new: false, is_digital: false },
  orders: { status: 'PENDING', payment_status: 'PENDING', discount: 0, shipping: 0, tax: 0 },
  categories: { sort_order: 0, is_active: true },
  collections: { is_active: true },
  coupons: { usage_count: 0, is_active: true },
  customers: { total_orders: 0, total_spent: 0 },
  payments: { currency: 'BRL', status: 'PENDING', installments: 1 },
  subscriptions: { status: 'PENDING', billing_cycle: 'MONTHLY', cancel_at_period_end: false },
  store_settings: {
    email_notifications: true, sms_notifications: false, order_confirmation: true,
    order_shipped: true, order_delivered: true, default_shipping: 0,
    tax_enabled: false, tax_rate: 0, tax_included: true, require_login: false,
    guest_checkout: true, accept_credit_card: true, accept_pix: true, accept_boleto: true,
  },
  store_customizations: {
    primary_color: '#000000', secondary_color: '#666666', accent_color: '#FF6B6B',
    background_color: '#FFFFFF', text_color: '#333333', heading_font: 'Inter',
    body_font: 'Inter', layout_style: 'modern', product_card_style: 'card',
    products_per_page: 12, show_banner: true, show_featured: true,
    show_new_arrivals: true, show_categories: true, show_reviews: true,
    show_sales_count: false,
  },
  product_images: { sort_order: 0, is_primary: false },
  product_variants: { quantity: 0 },
  product_reviews: { is_verified: false, is_approved: false, helpful_count: 0 },
  store_analytics: { visitors: 0, page_views: 0, orders: 0, revenue: 0, direct_traffic: 0, organic_traffic: 0, social_traffic: 0, referral_traffic: 0 },
}

// ── Column mapping (camelCase ↔ snake_case) ─────────────────────────────
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

function objToSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[camelToSnake(key)] = value
  }
  return result
}

function rowToCamel(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = value
  }
  return result
}

// ── WHERE clause builder (supports OR, NOT, operators) ─────────────────
function buildWhere(where: Record<string, any>, startIndex = 1): { sql: string; params: any[] } {
  const conditions: string[] = []
  const params: any[] = []
  let idx = startIndex

  for (const [key, value] of Object.entries(where)) {
    if (key === 'OR') {
      // OR: array of conditions
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

    const col = camelToSnake(key)
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
function buildOrderBy(orderBy: Record<string, string> | Record<string, string>[], table?: string): string {
  if (Array.isArray(orderBy)) {
    return orderBy.map(o => {
      const [key, dir] = Object.entries(o)[0]
      return `${camelToSnake(key)} ${dir === 'asc' ? 'ASC' : 'DESC'}`
    }).join(', ')
  }
  const [key, dir] = Object.entries(orderBy)[0]
  return `${camelToSnake(key)} ${dir === 'asc' ? 'ASC' : 'DESC'}`
}

// ── Include resolver ────────────────────────────────────────────────────
const RELATIONS: Record<string, Record<string, { table: string; fk: string; type: 'one' | 'many'; reverseFk?: string }>> = {
  users: {
    store: { table: 'stores', fk: 'user_id', type: 'one' },
  },
  stores: {
    user: { table: 'users', fk: 'id', type: 'one', reverseFk: 'user_id' },
    categories: { table: 'categories', fk: 'store_id', type: 'many' },
    products: { table: 'products', fk: 'store_id', type: 'many' },
    orders: { table: 'orders', fk: 'store_id', type: 'many' },
    customers: { table: 'customers', fk: 'store_id', type: 'many' },
    coupons: { table: 'coupons', fk: 'store_id', type: 'many' },
    collections: { table: 'collections', fk: 'store_id', type: 'many' },
    payments: { table: 'payments', fk: 'store_id', type: 'many' },
    subscriptions: { table: 'subscriptions', fk: 'user_id', type: 'many' },
    customization: { table: 'store_customizations', fk: 'store_id', type: 'one' },
    settings: { table: 'store_settings', fk: 'store_id', type: 'one' },
    analytics: { table: 'store_analytics', fk: 'store_id', type: 'many' },
  },
  products: {
    store: { table: 'stores', fk: 'store_id', type: 'one' },
    category: { table: 'categories', fk: 'id', type: 'one', reverseFk: 'category_id' },
    images: { table: 'product_images', fk: 'product_id', type: 'many' },
    variants: { table: 'product_variants', fk: 'product_id', type: 'many' },
    reviews: { table: 'product_reviews', fk: 'product_id', type: 'many' },
    collections: { table: 'collections', fk: 'store_id', type: 'many' },
    orderItems: { table: 'order_items', fk: 'product_id', type: 'many' },
  },
  orders: {
    store: { table: 'stores', fk: 'store_id', type: 'one' },
    customer: { table: 'customers', fk: 'id', type: 'one', reverseFk: 'customer_id' },
    items: { table: 'order_items', fk: 'order_id', type: 'many' },
    payments: { table: 'payments', fk: 'order_id', type: 'many' },
  },
  order_items: {
    product: { table: 'products', fk: 'id', type: 'one', reverseFk: 'product_id' },
    variant: { table: 'product_variants', fk: 'id', type: 'one', reverseFk: 'variant_id' },
    order: { table: 'orders', fk: 'order_id', type: 'one' },
  },
  payments: {
    order: { table: 'orders', fk: 'id', type: 'one', reverseFk: 'order_id' },
    subscription: { table: 'subscriptions', fk: 'id', type: 'one', reverseFk: 'subscription_id' },
    user: { table: 'users', fk: 'id', type: 'one', reverseFk: 'user_id' },
    store: { table: 'stores', fk: 'id', type: 'one' },
  },
  subscriptions: {
    plan: { table: 'plans', fk: 'plan_id', type: 'one' },
    user: { table: 'users', fk: 'user_id', type: 'one' },
    payments: { table: 'payments', fk: 'subscription_id', type: 'many' },
  },
  customers: {
    store: { table: 'stores', fk: 'store_id', type: 'one' },
    orders: { table: 'orders', fk: 'customer_id', type: 'many' },
  },
  categories: {
    store: { table: 'stores', fk: 'store_id', type: 'one' },
    products: { table: 'products', fk: 'category_id', type: 'many' },
  },
  coupons: {
    store: { table: 'stores', fk: 'store_id', type: 'one' },
  },
  collections: {
    store: { table: 'stores', fk: 'store_id', type: 'one' },
    products: { table: 'products', fk: 'store_id', type: 'many' },
  },
  product_images: {
    product: { table: 'products', fk: 'product_id', type: 'one' },
  },
  product_variants: {
    product: { table: 'products', fk: 'product_id', type: 'one' },
  },
  plans: {
    subscriptions: { table: 'subscriptions', fk: 'plan_id', type: 'many' },
  },
}

// Resolve includes (handles relations, _count, orderBy in includes)
async function resolveIncludes(
  mainRows: Record<string, any>[],
  table: string,
  include: Record<string, any>
): Promise<void> {
  if (!mainRows.length) return

  const tableRelations = RELATIONS[table]

  for (const [relName, relInclude] of Object.entries(include)) {
    // Handle _count
    if (relName === '_count') {
      await resolveCount(mainRows, table, relInclude)
      continue
    }

    if (!tableRelations || !tableRelations[relName]) continue
    const rel = tableRelations[relName]
    const relTable = rel.table

    // Extract orderBy from include spec if present
    let orderBy: any = undefined
    let nestedInclude: any = undefined
    if (typeof relInclude === 'object' && relInclude !== null) {
      if (relInclude.orderBy) {
        orderBy = relInclude.orderBy
      }
      if (relInclude.include) {
        nestedInclude = relInclude.include
      }
      // If relInclude only has orderBy/include (no `true`), still fetch the relation
    }

    if (rel.type === 'one') {
      if (rel.reverseFk) {
        const ids = [...new Set(mainRows.map(r => r.id))]
        let query = `SELECT * FROM "${relTable}" WHERE "${rel.reverseFk}" = ANY($1)`
        const queryParams: any[] = [ids]
        if (orderBy) query += ` ORDER BY ${buildOrderBy(orderBy, relTable)}`
        const relRows = await safeQuery(query, queryParams)
        const relMap = new Map<string, Record<string, any>>()
        for (const row of relRows) {
          const camelRow = rowToCamel(row)
          const fkValue = (row as any)[rel.reverseFk!]
          relMap.set(fkValue, camelRow)
        }
        for (const mainRow of mainRows) {
          mainRow[relName] = relMap.get(mainRow.id) || null
        }
      } else {
        const fkValues = [...new Set(mainRows.map(r => (r as any)[rel.fk])).filter(Boolean)]
        if (!fkValues.length) {
          for (const mainRow of mainRows) mainRow[relName] = null
          continue
        }
        const relRows = await safeQuery(`SELECT * FROM "${relTable}" WHERE id = ANY($1)`, [fkValues])
        const relMap = new Map<string, Record<string, any>>()
        for (const row of relRows) {
          const camelRow = rowToCamel(row)
          relMap.set(row.id, camelRow)
        }
        for (const mainRow of mainRows) {
          mainRow[relName] = relMap.get((mainRow as any)[rel.fk]) || null
        }
      }
      // Nested includes on related rows
      if (nestedInclude || (typeof relInclude === 'object' && relInclude !== null && !orderBy)) {
        const nestedRows = mainRows.map(r => r[relName]).filter(Boolean)
        if (nestedRows.length) {
          // Use the include spec minus orderBy for nested resolution
          const nestedSpec = { ...relInclude }
          delete nestedSpec.orderBy
          await resolveIncludes(nestedRows, relTable, nestedSpec)
        }
      }
    } else {
      // One-to-many
      const ids = [...new Set(mainRows.map(r => r.id))]
      let query = `SELECT * FROM "${relTable}" WHERE "${rel.fk}" = ANY($1)`
      const queryParams: any[] = [ids]
      if (orderBy) query += ` ORDER BY ${buildOrderBy(orderBy, relTable)}`
      const relRows = await safeQuery(query, queryParams)
      const relMap = new Map<string, Record<string, any>[]>()
      for (const row of relRows) {
        const camelRow = rowToCamel(row)
        const fkValue = (row as any)[rel.fk]
        if (!relMap.has(fkValue)) relMap.set(fkValue, [])
        relMap.get(fkValue)!.push(camelRow)
      }
      for (const mainRow of mainRows) {
        mainRow[relName] = relMap.get(mainRow.id) || []
      }
      // Nested includes
      if (nestedInclude || (typeof relInclude === 'object' && relInclude !== null && !orderBy)) {
        const allNestedRows = mainRows.flatMap(r => r[relName] || [])
        if (allNestedRows.length) {
          const nestedSpec = { ...relInclude }
          delete nestedSpec.orderBy
          await resolveIncludes(allNestedRows, relTable, nestedSpec)
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
    // Count all relations
    for (const [relName, rel] of Object.entries(tableRelations)) {
      if (rel.type !== 'many') continue
      const ids = [...new Set(mainRows.map(r => r.id))]
      const rows = await safeQuery(
        `SELECT "${rel.fk}" as fk, COUNT(*)::int as count FROM "${rel.table}" WHERE "${rel.fk}" = ANY($1) GROUP BY "${rel.fk}"`,
        [ids]
      )
      const countMap = new Map<string, number>()
      for (const row of rows) {
        countMap.set((row as any).fk, (row as any).count)
      }
      for (const mainRow of mainRows) {
        if (!mainRow._count) mainRow._count = {}
        mainRow._count[relName] = countMap.get(mainRow.id) || 0
      }
    }
  } else if (typeof countSpec === 'object') {
    // Count specific relations
    for (const [relName, shouldCount] of Object.entries(countSpec)) {
      if (!shouldCount) continue
      const rel = tableRelations[relName]
      if (!rel || rel.type !== 'many') continue

      const ids = [...new Set(mainRows.map(r => r.id))]
      const rows = await safeQuery(
        `SELECT "${rel.fk}" as fk, COUNT(*)::int as count FROM "${rel.table}" WHERE "${rel.fk}" = ANY($1) GROUP BY "${rel.fk}"`,
        [ids]
      )
      const countMap = new Map<string, number>()
      for (const row of rows) {
        countMap.set((row as any).fk, (row as any).count)
      }
      for (const mainRow of mainRows) {
        if (!mainRow._count) mainRow._count = {}
        mainRow._count[relName] = countMap.get(mainRow.id) || 0
      }
    }
  }
}

// ── Apply defaults for missing columns ──────────────────────────────────
function applyDefaults(snakeData: Record<string, any>, table: string): Record<string, any> {
  const defaults = DEFAULTS_MAP[table]
  if (!defaults) return snakeData
  const result = { ...snakeData }
  for (const [key, defaultVal] of Object.entries(defaults)) {
    if (!(key in result) || result[key] === undefined) {
      result[key] = defaultVal
    }
  }
  return result
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
      const row = rowToCamel(rows[0] as Record<string, any>)
      if (args.include) {
        await resolveIncludes([row], table, args.include)
      }
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
      if (args.orderBy) {
        parts.push(`ORDER BY ${buildOrderBy(args.orderBy, table)}`)
      }
      parts.push('LIMIT 1')
      const rows = await safeQuery(parts.join(' '), params)
      if (!rows.length) return null
      const row = rowToCamel(rows[0] as Record<string, any>)
      if (args.include) {
        await resolveIncludes([row], table, args.include)
      }
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
      if (args.orderBy) {
        parts.push(`ORDER BY ${buildOrderBy(args.orderBy, table)}`)
      }
      if (args.take !== undefined) {
        parts.push(`LIMIT $${paramIdx++}`)
        params.push(args.take)
      }
      if (args.skip !== undefined) {
        parts.push(`OFFSET $${paramIdx++}`)
        params.push(args.skip)
      }

      const rows = await safeQuery(parts.join(' '), params)
      const result = rows.map((r: any) => rowToCamel(r as Record<string, any>))
      if (args.include) {
        await resolveIncludes(result, table, args.include)
      }
      return result
    },

    create: async (args: { data: Record<string, any>; include?: Record<string, any> }) => {
      const data = objToSnake(args.data)

      // Handle nested creates (e.g., store: { create: { ... } })
      const nestedCreates: Array<{ relName: string; table: string; fk: string; data: Record<string, any> }> = []
      const cleanData: Record<string, any> = {}

      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && !Array.isArray(value) && value.create) {
          const camelRelName = Object.keys(args.data).find(k => camelToSnake(k) === key)
          if (camelRelName) {
            const relInfo = RELATIONS[table]?.[camelRelName]
            if (relInfo) {
              const nestedData = objToSnake(value.create)
              nestedCreates.push({
                relName: camelRelName,
                table: relInfo.table,
                fk: relInfo.reverseFk || relInfo.fk,
                data: nestedData,
              })
            }
          }
        } else {
          cleanData[key] = value
        }
      }

      // Generate ID if not provided (replaces @default(cuid()))
      if (!cleanData.id) {
        cleanData.id = cuid()
      }

      // Apply column defaults
      const dataWithDefaults = applyDefaults(cleanData, table)

      const cols = Object.keys(dataWithDefaults)
      const vals = Object.values(dataWithDefaults)
      const placeholders = vals.map((_, i) => `$${i + 1}`)

      const rows = await safeQuery(
        `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        vals
      )
      if (!rows.length) throw new Error(`Failed to create ${model}: no rows returned`)
      const row = rowToCamel(rows[0] as Record<string, any>)

      // Execute nested creates
      for (const nested of nestedCreates) {
        const nestedDataWithFk = { ...nested.data }
        // Generate ID for nested record too
        if (!nestedDataWithFk.id) {
          nestedDataWithFk.id = cuid()
        }
        // Set the foreign key to the parent's ID
        nestedDataWithFk[nested.fk] = row.id
        // Apply defaults for nested table
        const nestedWithDefaults = applyDefaults(nestedDataWithFk, nested.table)

        const nestedCols = Object.keys(nestedWithDefaults)
        const nestedVals = Object.values(nestedWithDefaults)
        const nestedPlaceholders = nestedVals.map((_, i) => `$${i + 1}`)
        const nestedRows = await safeQuery(
          `INSERT INTO "${nested.table}" (${nestedCols.map(c => `"${c}"`).join(', ')}) VALUES (${nestedPlaceholders.join(', ')}) RETURNING *`,
          nestedVals
        )
        if (nestedRows.length) {
          row[nested.relName] = rowToCamel(nestedRows[0] as Record<string, any>)
        }
      }

      if (args.include) {
        await resolveIncludes([row], table, args.include)
      }
      return row
    },

    update: async (args: { where: Record<string, any>; data: Record<string, any>; include?: Record<string, any> }) => {
      const data = objToSnake(args.data)
      const { sql: whereSql, params: whereParams } = buildWhere(args.where)

      const setParts: string[] = []
      const setParams: any[] = []
      let paramIdx = 1

      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          if ('decrement' in value) {
            setParts.push(`"${key}" = "${key}" - $${paramIdx++}`)
            setParams.push(value.decrement)
          } else if ('increment' in value) {
            setParts.push(`"${key}" = "${key}" + $${paramIdx++}`)
            setParams.push(value.increment)
          } else if ('push' in value) {
            // JSON array push
            setParts.push(`"${key}" = COALESCE("${key}"::jsonb, '[]'::jsonb) || $${paramIdx++}::jsonb`)
            setParams.push(JSON.stringify(value.push))
          }
        } else {
          setParts.push(`"${key}" = $${paramIdx++}`)
          setParams.push(value)
        }
      }

      const allParams = [...setParams, ...whereParams]
      const rows = await safeQuery(
        `UPDATE "${table}" SET ${setParts.join(', ')} WHERE ${whereSql} RETURNING *`,
        allParams
      )
      if (!rows.length) return null
      const row = rowToCamel(rows[0] as Record<string, any>)
      if (args.include) {
        await resolveIncludes([row], table, args.include)
      }
      return row
    },

    delete: async (args: { where: Record<string, any> }) => {
      const { sql: whereSql, params } = buildWhere(args.where)
      const rows = await safeQuery(`DELETE FROM "${table}" WHERE ${whereSql} RETURNING *`, params)
      if (!rows.length) return null
      return rowToCamel(rows[0] as Record<string, any>)
    },

    deleteMany: async (args: { where: Record<string, any> }) => {
      const { sql: whereSql, params } = buildWhere(args.where)
      const rows = await safeQuery(`DELETE FROM "${table}" WHERE ${whereSql} RETURNING *`, params)
      return { count: rows.length }
    },

    updateMany: async (args: { where: Record<string, any>; data: Record<string, any> }) => {
      const data = objToSnake(args.data)
      const { sql: whereSql, params: whereParams } = buildWhere(args.where)
      const setParts: string[] = []
      const setParams: any[] = []
      let paramIdx = 1
      for (const [key, value] of Object.entries(data)) {
        setParts.push(`"${key}" = $${paramIdx++}`)
        setParams.push(value)
      }
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
      if (args._max) { for (const col of Object.keys(args._max)) selects.push(`MAX("${camelToSnake(col)}") as "max_${camelToSnake(col)}"`) }
      if (args._sum) { for (const col of Object.keys(args._sum)) selects.push(`SUM("${camelToSnake(col)}") as "sum_${camelToSnake(col)}"`) }
      if (args._min) { for (const col of Object.keys(args._min)) selects.push(`MIN("${camelToSnake(col)}") as "min_${camelToSnake(col)}"`) }
      if (args._avg) { for (const col of Object.keys(args._avg)) selects.push(`AVG("${camelToSnake(col)}") as "avg_${camelToSnake(col)}"`) }
      if (args._count === true) { selects.push('COUNT(*)::int as "_count_all"') }
      else if (typeof args._count === 'object') { for (const col of Object.keys(args._count)) selects.push(`COUNT("${camelToSnake(col)}")::int as "_count_${camelToSnake(col)}"`) }
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
        const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
        if (key.startsWith('max_')) { if (!result._max) result._max = {}; result._max[camelKey.replace('max_', '')] = value }
        else if (key.startsWith('sum_')) { if (!result._sum) result._sum = {}; result._sum[camelKey.replace('sum_', '')] = value }
        else if (key.startsWith('min_')) { if (!result._min) result._min = {}; result._min[camelKey.replace('min_', '')] = value }
        else if (key.startsWith('avg_')) { if (!result._avg) result._avg = {}; result._avg[camelKey.replace('avg_', '')] = value }
        else if (key.startsWith('_count_')) { if (!result._count) result._count = {} as any; (result._count as any)[camelKey.replace('_count_', '')] = value }
        else if (key === '_count_all') { result._count = value }
      }
      return result
    },

    upsert: async (args: { where: Record<string, any>; create: Record<string, any>; update: Record<string, any>; include?: Record<string, any> }) => {
      const { sql: whereSql, params: whereParams } = buildWhere(args.where)
      const existing = await safeQuery(`SELECT * FROM "${table}" WHERE ${whereSql} LIMIT 1`, whereParams)
      if (existing.length > 0) {
        const data = objToSnake(args.update)
        const setParts: string[] = []
        const setParams: any[] = []
        let paramIdx = 1
        for (const [key, value] of Object.entries(data)) {
          setParts.push(`"${key}" = $${paramIdx++}`)
          setParams.push(value)
        }
        const allParams = [...setParams, ...whereParams]
        const rows = await safeQuery(`UPDATE "${table}" SET ${setParts.join(', ')} WHERE ${whereSql} RETURNING *`, allParams)
        const row = rowToCamel(rows[0] as Record<string, any>)
        if (args.include) await resolveIncludes([row], table, args.include)
        return row
      } else {
        const data = objToSnake(args.create)
        if (!data.id) data.id = cuid()
        const dataWithDefaults = applyDefaults(data, table)
        const cols = Object.keys(dataWithDefaults)
        const vals = Object.values(dataWithDefaults)
        const placeholders = vals.map((_, i) => `$${i + 1}`)
        const rows = await safeQuery(
          `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
          vals
        )
        const row = rowToCamel(rows[0] as Record<string, any>)
        if (args.include) await resolveIncludes([row], table, args.include)
        return row
      }
    },

    createMany: async (args: { data: Record<string, any>[] }) => {
      let count = 0
      for (const item of args.data) {
        const data = objToSnake(item)
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
