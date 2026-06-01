import { NextResponse } from "next/server";
import { isS3Configured } from "@/lib/s3";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "Pulso Body",
    database: process.env.DATABASE_URL ? "configured" : "missing",
    storage: isS3Configured() ? "configured" : "missing",
  });
}
