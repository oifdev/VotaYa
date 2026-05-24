import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  return NextResponse.json({
    message: "Debug information",
    cookies: allCookies,
    env: {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Exists" : "Missing",
      SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "Exists" : "Missing",
    }
  });
}
