/**
 * Database access layer using Neon serverless driver directly.
 *
 * WHY NOT PRISMA?
 * Prisma Client internally calls `fs.readdir` to discover its query engine binary.
 * Cloudflare Workers has no filesystem → `[unenv] fs.readdir is not implemented yet!`.
 * The `/edge` import doesn't support driver adapters either.
 * So we bypass Prisma entirely and use raw SQL via the Neon HTTP driver.
 *
 * This module provides a Prisma-compatible API so routes don't need changes:
 *   db.user.findUnique({ where: { email } })
 *   db.product.findMany({ where: { storeId }, include: { category: true } })
 *   etc.
 */
import { neon } from '@neondatabase/serverless'
import type { TaggedTemplateLiteralInvocation } from '@neondatabase/serverless'

// ── Connection ──────────────────────────────────────────────────────────
let _sql: TaggedTemplateLiteralInvocation<true, true>

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

// ── Column mapping (camelCase → snake_case) ─────────────────────────────
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
      // Handle special operators
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

// ── Include resolver (handles relations via JOINs or extra queries) ─────
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
      // One-to-one: fetch related rows by foreign key
      if (rel.reverseFk) {
        // The FK is on the related table pointing to our table
        const ids = [...new Set(mainRows.map(r => r.id))]
        const sql = getSql()
        const relRows = await sql`SELECT * FROM ${sql(relTable)} WHERE ${sql(rel.reverseFk)} = ANY(${ids})`
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
        const fkCol = camelToSnake(rel.fk)
        const fkValues = [...new Set(mainRows.map(r => (r as any)[rel.fk])).filter(Boolean)]
        if (!fkValues.length) {
          for (const mainRow of mainRows) mainRow[relName] = null
          continue
        }
        const sql = getSql()
        const relRows = await sql`SELECT * FROM ${sql(relTable)} WHERE id = ANY(${fkValues})`
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
      const sql = getSql()
      const relRows = await sql`SELECT * FROM ${sql(relTable)} WHERE ${sql(rel.fk)} = ANY(${ids})`
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
      const sql = getSql()
      const rows = await sql.unsafe(`SELECT * FROM "${table}" WHERE ${whereSql} LIMIT 1`, params)
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

      const sql = getSql()
      const rows = await sql.unsafe(parts.join(' '), params)
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

      const sql = getSql()
      const rows = await sql.unsafe(parts.join(' '), params)
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

      const sql = getSql()
      const rows = await sql.unsafe(
        `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        vals
      )
      const row = rowToCamel(rows[0] as Record<string, any>)

      // Execute nested creates
      for (const nested of nestedCreates) {
        const nestedDataWithFk = { ...nested.data }
        // For store.create inside user.create, user_id is the FK on stores
        nestedDataWithFk[nested.fk] = row.id
        const nestedCols = Object.keys(nestedDataWithFk)
        const nestedVals = Object.values(nestedDataWithFk)
        const nestedPlaceholders = nestedVals.map((_, i) => `$${i + 1}`)
        const nestedRows = await sql.unsafe(
          `INSERT INTO "${nested.table}" (${nestedCols.map(c => `"${c}"`).join(', ')}) VALUES (${nestedPlaceholders.join(', ')}) RETURNING *`,
          nestedVals
        )
        const nestedRow = rowToCamel(nestedRows[0] as Record<string, any>)
        // Attach the nested result to the main row
        const camelFk = nested.fk.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
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
          // Handle special operators like { decrement: n }
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
      const sql = getSql()
      const rows = await sql.unsafe(
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
      const sql = getSql()
      const rows = await sql.unsafe(`DELETE FROM "${table}" WHERE ${whereSql} RETURNING *`, params)
      if (!rows.length) return null
      return rowToCamel(rows[0] as Record<string, any>)
    },

    deleteMany: async (args: { where: Record<string, any> }) => {
      const { sql: whereSql, params } = buildWhere(args.where)
      const sql = getSql()
      const rows = await sql.unsafe(`DELETE FROM "${table}" WHERE ${whereSql} RETURNING *`, params)
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
      const sql = getSql()
      const rows = await sql.unsafe(
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

      const sql = getSql()
      const rows = await sql.unsafe(parts.join(' '), params)
      return (rows[0] as any).count
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

      const sql = getSql()
      const rows = await sql.unsafe(parts.join(' '), params)
      const row = rows[0] as Record<string, any>
      // Convert to Prisma-like aggregate result
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
      const sql = getSql()
      // Try to find first
      const { sql: whereSql, params: whereParams } = buildWhere(args.where)
      const existing = await sql.unsafe(`SELECT * FROM "${table}" WHERE ${whereSql} LIMIT 1`, whereParams)

      if (existing.length > 0) {
        // Update
        const data = objToSnake(args.update)
        const setParts: string[] = []
        const setParams: any[] = []
        let paramIdx = 1
        for (const [key, value] of Object.entries(data)) {
          setParts.push(`"${key}" = $${paramIdx++}`)
          setParams.push(value)
        }
        const allParams = [...setParams, ...whereParams]
        const rows = await sql.unsafe(`UPDATE "${table}" SET ${setParts.join(', ')} WHERE ${whereSql} RETURNING *`, allParams)
        const row = rowToCamel(rows[0] as Record<string, any>)
        if (args.include) await resolveIncludes([row], table, args.include)
        return row
      } else {
        // Create
        const data = objToSnake(args.create)
        const cols = Object.keys(data)
        const vals = Object.values(data)
        const placeholders = vals.map((_, i) => `$${i + 1}`)
        const rows = await sql.unsafe(
          `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
          vals
        )
        const row = rowToCamel(rows[0] as Record<string, any>)
        if (args.include) await resolveIncludes([row], table, args.include)
        return row
      }
    },

    createMany: async (args: { data: Record<string, any>[] }) => {
      const sql = getSql()
      let count = 0
      for (const item of args.data) {
        const data = objToSnake(item)
        const cols = Object.keys(data)
        const vals = Object.values(data)
        const placeholders = vals.map((_, i) => `$${i + 1}`)
        await sql.unsafe(
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
          const sql = getSql()
          return sql.unsafe(query, params || [])
        }
      }
    }
    // Model repository
    return createRepo(prop)
  }
})
