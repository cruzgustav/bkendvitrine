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
 * (tagged template literals) works correctly, so we convert all parameterized
 * queries ($1, $2, ...) into tagged template literal calls.
 *
 * This module provides a Prisma-compatible API so routes don't need changes:
 *   db.user.findUnique({ where: { email } })
 *   db.product.findMany({ where: { storeId }, include: { category: true } })
 *   etc.
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

// ── Result normalization ────────────────────────────────────────────────
// The Neon serverless driver may return results in different formats:
//   - Array of rows: [{ col: val }, ...]          ← default
//   - Object with rows: { rows: [{ col: val }] }  ← fullResults mode
// This function normalizes ALL formats to a plain array.
function normalizeRows(result: any): any[] {
  if (Array.isArray(result)) return result
  if (result && typeof result === 'object') {
    if (Array.isArray(result.rows)) return result.rows
    if (Array.isArray(result.results)) return result.results
    if (result.result && typeof result.result === 'object' && Array.isArray(result.result.rows)) {
      return result.result.rows
    }
  }
  // Unexpected format - log and return empty
  console.error('[DB normalizeRows] Unexpected result:',
    typeof result,
    Array.isArray(result) ? 'array' : 'not-array',
    result && typeof result === 'object' ? 'keys=' + Object.keys(result).join(',') : String(result))
  return []
}

// ── Convert $1/$2 parameterized SQL to tagged template literal call ────
// sql.unsafe('SELECT * FROM users WHERE id = $1', ['123'])
//   → sql`SELECT * FROM users WHERE id = ${'123'}`
//
// This is necessary because sql.unsafe() returns a descriptor object
// on Cloudflare Workers instead of executing the query.
function sqlToTemplateArgs(query: string, params: any[]): any[] {
  if (params.length === 0) {
    // No params: create a simple TemplateStringsArray
    const strings = [query] as any as TemplateStringsArray
    ;(strings as any).raw = [query]
    return [strings]
  }

  // Split the query at $N placeholders
  // e.g., "SELECT * FROM t WHERE a = $1 AND b = $2"
  //   → ["SELECT * FROM t WHERE a = ", " AND b = ", ""]
  //   with params in order
  const parts = query.split(/\$(\d+)/)
  const strings: string[] = []
  const orderedParams: any[] = []

  // parts[0] = text before first placeholder
  // parts[1] = digit of first placeholder (e.g., "1")
  // parts[2] = text after first placeholder
  // parts[3] = digit of second placeholder, etc.
  let currentString = parts[0]
  for (let i = 1; i < parts.length; i += 2) {
    const paramIndex = parseInt(parts[i], 10)
    const nextText = parts[i + 1] || ''

    strings.push(currentString)
    orderedParams.push(params[paramIndex - 1]) // $1 → params[0]
    currentString = nextText
  }
  strings.push(currentString)

  const templateStrings = strings as any as TemplateStringsArray
  ;(templateStrings as any).raw = [...strings]

  return [templateStrings, ...orderedParams]
}

// ── Safe query execution using tagged template literals ─────────────────
async function safeQuery(query: string, params: any[] = []): Promise<any[]> {
  const sql = getSql()
  try {
    // Primary approach: use tagged template literal (works on Cloudflare Workers)
    const templateArgs = sqlToTemplateArgs(query, params)
    const raw = await sql(...templateArgs)
    return normalizeRows(raw)
  } catch (primaryErr: any) {
    console.error('[DB safeQuery] Template literal failed:',
      primaryErr.message || String(primaryErr))

    // Fallback: try sql.unsafe() (might work in some environments)
    try {
      const raw = await sql.unsafe(query, params)
      const rows = normalizeRows(raw)
      if (rows.length > 0) return rows
      // If normalizeRows returned empty but raw wasn't empty, it might be a descriptor
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.sql) {
        // sql.unsafe() returned a descriptor, not results — throw to indicate failure
        throw new Error('sql.unsafe() returned descriptor instead of results')
      }
      return rows
    } catch (fallbackErr: any) {
      console.error('[DB safeQuery] sql.unsafe() fallback also failed:',
        fallbackErr.message || String(fallbackErr))
      // Throw the original error
      throw primaryErr
    }
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
    const sql = getSql()
    details.sqlType = typeof sql
    details.sqlUnsafeType = typeof sql?.unsafe

    // Test 1: Tagged template literal (primary API)
    const templateResult = await sql`SELECT 1 as test`
    details.templateResultType = typeof templateResult
    details.templateIsArray = Array.isArray(templateResult)
    details.templateKeys = templateResult && typeof templateResult === 'object' && !Array.isArray(templateResult)
      ? Object.keys(templateResult).slice(0, 10).join(',')
      : 'N/A'
    details.templatePreview = JSON.stringify(templateResult).slice(0, 300)
    const templateRows = normalizeRows(templateResult)
    details.templateRowCount = templateRows.length

    // Test 2: sql.unsafe() (secondary API - known to be broken on Workers)
    try {
      const unsafeResult = await sql.unsafe('SELECT 1 as test')
      details.unsafeResultType = typeof unsafeResult
      details.unsafeIsArray = Array.isArray(unsafeResult)
      details.unsafePreview = JSON.stringify(unsafeResult).slice(0, 300)
    } catch (unsafeErr: any) {
      details.unsafeError = unsafeErr.message || String(unsafeErr)
    }

    // Test 3: safeQuery (our wrapper that uses template literals)
    const safeRows = await safeQuery('SELECT 1 as test')
    details.safeQueryRows = safeRows.length
    details.safeQueryPreview = JSON.stringify(safeRows).slice(0, 200)

    // Test 4: Actual table query
    const planRows = await safeQuery('SELECT COUNT(*)::int as count FROM plans')
    details.planCount = planRows.length > 0 ? (planRows[0] as any).count : -1

    return { ok: true, details }
  } catch (err: any) {
    details.error = err.message || String(err)
    details.errorStack = err.stack?.split('\n').slice(0, 5).join(' | ')
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

// ── WHERE clause builder ────────────────────────────────────────────────
function buildWhere(where: Record<string, any>, startIndex = 1): { sql: string; params: any[] } {
  const conditions: string[] = []
  const params: any[] = []
  let idx = startIndex

  for (const [key, value] of Object.entries(where)) {
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
        conditions.push(`${col} != $${idx++}`)
        params.push(value.not)
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
      return `${camelToSnake(key)} ${dir === 'asc' ? 'ASC' : 'DESC'}`
    }).join(', ')
  }
  const [key, dir] = Object.entries(orderBy)[0]
  return `${camelToSnake(key)} ${dir === 'asc' ? 'ASC' : 'DESC'}`
}

// ── Include resolver (handles relations via extra queries) ─────────────
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

async function resolveIncludes(
  mainRows: Record<string, any>[],
  table: string,
  include: Record<string, any>
): Promise<void> {
  if (!mainRows.length) return

  const tableRelations = RELATIONS[table]
  if (!tableRelations) return

  for (const [relName, relInclude] of Object.entries(include)) {
    const rel = tableRelations[relName]
    if (!rel) continue

    const relTable = rel.table

    if (rel.type === 'one') {
      if (rel.reverseFk) {
        // The FK is on the related table pointing to our table
        const ids = [...new Set(mainRows.map(r => r.id))]
        const relRows = await safeQuery(
          `SELECT * FROM "${relTable}" WHERE "${rel.reverseFk}" = ANY($1)`,
          [ids]
        )
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
        // The FK is on our table pointing to the related table
        const fkValues = [...new Set(mainRows.map(r => (r as any)[rel.fk])).filter(Boolean)]
        if (!fkValues.length) {
          for (const mainRow of mainRows) mainRow[relName] = null
          continue
        }
        const relRows = await safeQuery(
          `SELECT * FROM "${relTable}" WHERE id = ANY($1)`,
          [fkValues]
        )
        const relMap = new Map<string, Record<string, any>>()
        for (const row of relRows) {
          const camelRow = rowToCamel(row)
          relMap.set(row.id, camelRow)
        }
        for (const mainRow of mainRows) {
          mainRow[relName] = relMap.get((mainRow as any)[rel.fk]) || null
        }
      }
      // Nested includes
      if (typeof relInclude === 'object' && relInclude !== null) {
        const nestedRows = mainRows.map(r => r[relName]).filter(Boolean)
        await resolveIncludes(nestedRows, relTable, relInclude)
      }
    } else {
      // One-to-many: fetch related rows
      const ids = [...new Set(mainRows.map(r => r.id))]
      const relRows = await safeQuery(
        `SELECT * FROM "${relTable}" WHERE "${rel.fk}" = ANY($1)`,
        [ids]
      )
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
      if (typeof relInclude === 'object' && relInclude !== null) {
        const allNestedRows = mainRows.flatMap(r => r[relName] || [])
        await resolveIncludes(allNestedRows, relTable, relInclude)
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
        parts.push(`ORDER BY ${buildOrderBy(args.orderBy)}`)
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
        parts.push(`ORDER BY ${buildOrderBy(args.orderBy)}`)
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
      const nestedCreates: Array<{ table: string; fk: string; data: Record<string, any> }> = []
      const cleanData: Record<string, any> = {}
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && value.create) {
          const relInfo = RELATIONS[table]?.[Object.keys(args.data).find(k => camelToSnake(k) === key) || '']
          if (relInfo) {
            const nestedData = objToSnake(value.create)
            nestedCreates.push({ table: relInfo.table, fk: relInfo.reverseFk || relInfo.fk, data: nestedData })
          }
        } else {
          cleanData[key] = value
        }
      }

      const cols = Object.keys(cleanData)
      const vals = Object.values(cleanData)
      const placeholders = vals.map((_, i) => `$${i + 1}`)

      const rows = await safeQuery(
        `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        vals
      )
      const row = rowToCamel(rows[0] as Record<string, any>)

      // Execute nested creates
      for (const nested of nestedCreates) {
        const nestedDataWithFk = { ...nested.data }
        nestedDataWithFk[nested.fk] = row.id
        const nestedCols = Object.keys(nestedDataWithFk)
        const nestedVals = Object.values(nestedDataWithFk)
        const nestedPlaceholders = nestedVals.map((_, i) => `$${i + 1}`)
        const nestedRows = await safeQuery(
          `INSERT INTO "${nested.table}" (${nestedCols.map(c => `"${c}"`).join(', ')}) VALUES (${nestedPlaceholders.join(', ')}) RETURNING *`,
          nestedVals
        )
        const nestedRow = rowToCamel(nestedRows[0] as Record<string, any>)
        const relName = Object.keys(args.data).find(k => {
          const val = (args.data as any)[k]
          return val && typeof val === 'object' && val.create
        })
        if (relName) {
          row[relName] = nestedRow
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

      if (args._max) {
        for (const col of Object.keys(args._max)) {
          selects.push(`MAX("${camelToSnake(col)}") as "max_${camelToSnake(col)}"`)
        }
      }
      if (args._sum) {
        for (const col of Object.keys(args._sum)) {
          selects.push(`SUM("${camelToSnake(col)}") as "sum_${camelToSnake(col)}"`)
        }
      }
      if (args._min) {
        for (const col of Object.keys(args._min)) {
          selects.push(`MIN("${camelToSnake(col)}") as "min_${camelToSnake(col)}"`)
        }
      }
      if (args._avg) {
        for (const col of Object.keys(args._avg)) {
          selects.push(`AVG("${camelToSnake(col)}") as "avg_${camelToSnake(col)}"`)
        }
      }
      if (args._count === true) {
        selects.push('COUNT(*)::int as "_count_all"')
      } else if (typeof args._count === 'object') {
        for (const col of Object.keys(args._count)) {
          selects.push(`COUNT("${camelToSnake(col)}")::int as "_count_${camelToSnake(col)}"`)
        }
      }

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
        if (key.startsWith('max_')) {
          if (!result._max) result._max = {}
          result._max[camelKey.replace('max_', '')] = value
        } else if (key.startsWith('sum_')) {
          if (!result._sum) result._sum = {}
          result._sum[camelKey.replace('sum_', '')] = value
        } else if (key.startsWith('min_')) {
          if (!result._min) result._min = {}
          result._min[camelKey.replace('min_', '')] = value
        } else if (key.startsWith('avg_')) {
          if (!result._avg) result._avg = {}
          result._avg[camelKey.replace('avg_', '')] = value
        } else if (key.startsWith('_count_')) {
          if (!result._count) result._count = {} as any
          ;(result._count as any)[camelKey.replace('_count_', '')] = value
        } else if (key === '_count_all') {
          result._count = value
        }
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
        const cols = Object.keys(data)
        const vals = Object.values(data)
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
        const cols = Object.keys(data)
        const vals = Object.values(data)
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

// ── Export db proxy (same API as before: db.user.findUnique, etc.) ──────
export const db = new Proxy({} as any, {
  get(_target, prop: string | symbol) {
    if (typeof prop !== 'string') return undefined
    // Handle $transaction - execute all promises sequentially
    if (prop === '$transaction') {
      return async (promises: Promise<any>[]) => {
        const results = []
        for (const promise of promises) {
          results.push(await promise)
        }
        return results
      }
    }
    // Handle $queryRaw
    if (prop === '$queryRaw') {
      return {
        unsafe: async (query: string, params?: any[]) => {
          return safeQuery(query, params || [])
        }
      }
    }
    // Model repository
    return createRepo(prop)
  }
})
