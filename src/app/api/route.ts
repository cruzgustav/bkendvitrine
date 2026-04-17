import { NextResponse } from "next/server";
import { db, testConnection } from "@/lib/db";

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL_set: !!process.env.DATABASE_URL,
      DATABASE_URL_prefix: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.substring(0, 25) + "..."
        : "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  // Run detailed connection test
  const connTest = await testConnection();
  diagnostics.connection_test = connTest.ok ? "OK ✅" : "FAILED ❌";
  diagnostics.connection_details = connTest.details;

  // Test Prisma-like queries
  try {
    const result = await db.plan.findMany({ where: {} });
    diagnostics.db_query = "OK ✅";
    diagnostics.db_plan_count = result.length;
  } catch (dbError: any) {
    diagnostics.db_query = "FAILED ❌";
    diagnostics.db_query_error = dbError.message || String(dbError);
  }

  // Discover actual column names in products table
  try {
    const cols = await db.$queryRaw.unsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position"
    );
    diagnostics.products_columns = cols.map((c: any) => c.column_name);
  } catch (e: any) {
    diagnostics.products_columns_error = e.message || String(e);
  }

  // Also check stores columns
  try {
    const cols = await db.$queryRaw.unsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'stores' ORDER BY ordinal_position"
    );
    diagnostics.stores_columns = cols.map((c: any) => c.column_name);
  } catch (e: any) {
    diagnostics.stores_columns_error = e.message || String(e);
  }

  // Check categories columns
  try {
    const cols = await db.$queryRaw.unsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'categories' ORDER BY ordinal_position"
    );
    diagnostics.categories_columns = cols.map((c: any) => c.column_name);
  } catch (e: any) {
    diagnostics.categories_columns_error = e.message || String(e);
  }

  // Check users columns
  try {
    const cols = await db.$queryRaw.unsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position"
    );
    diagnostics.users_columns = cols.map((c: any) => c.column_name);
  } catch (e: any) {
    diagnostics.users_columns_error = e.message || String(e);
  }

  return NextResponse.json(diagnostics);
}
