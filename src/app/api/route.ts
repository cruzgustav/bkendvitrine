
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      DATABASE_URL_set: !!process.env.DATABASE_URL,
      DATABASE_URL_prefix: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.substring(0, 20) + "..."
        : "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  try {
    // Teste simples de conexão com o banco
    await db.$queryRaw`SELECT 1 as test`;
    diagnostics.db_connection = "OK ✅";
  } catch (dbError: any) {
    diagnostics.db_connection = "FAILED ❌";
    diagnostics.db_error = dbError.message || String(dbError);
    diagnostics.db_error_code = dbError.code || "no code";
  }

  return NextResponse.json(diagnostics);
}