import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const reqCookies = request.cookies.getAll();
  
  return NextResponse.json({
    message: "Debug information",
    cookies_from_headers: allCookies,
    cookies_from_request: reqCookies,
    env: {
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "Exists" : "Missing",
      SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? "Exists" : "Missing",
    }
  });
}
