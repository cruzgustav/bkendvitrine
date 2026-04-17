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

  // Also test a simple Prisma-like query via db proxy
  try {
    const result = await db.plan.findMany({ where: {} });
    diagnostics.db_query = "OK ✅";
    diagnostics.db_plan_count = result.length;
    diagnostics.db_plans_preview = result.slice(0, 2);
  } catch (dbError: any) {
    diagnostics.db_query = "FAILED ❌";
    diagnostics.db_query_error = dbError.message || String(dbError);
    diagnostics.db_query_stack = dbError.stack?.split('\n').slice(0, 5);
  }

  return NextResponse.json(diagnostics);
}
