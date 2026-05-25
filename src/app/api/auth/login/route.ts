import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseBrowserEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;
    const { supabaseUrl, supabaseAnonKey } = requireSupabaseBrowserEnv();

    // We create the success response first so we can attach cookies to it
    const successResponse = NextResponse.json({ success: true });
    const cookiesToSetLater: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookiesToSet) {
          // Collect cookies to set after we confirm no error
          cookiesToSet.forEach(({ name, value, options }) => {
            cookiesToSetLater.push({ name, value, options: options || {} });
          });
        },
      },
    });

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // Only apply cookies if login was successful
    cookiesToSetLater.forEach(({ name, value, options }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      successResponse.cookies.set(name, value, options as any);
    });

    return successResponse;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
