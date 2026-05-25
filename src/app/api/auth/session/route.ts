import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { requireSupabaseBrowserEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        const { access_token, refresh_token } = await request.json();
        if (!access_token || !refresh_token) {
            return NextResponse.json({ error: "Tokens requeridos" }, { status: 400 });
        }

        const { supabaseUrl, supabaseAnonKey } = requireSupabaseBrowserEnv();
        const response = NextResponse.json({ success: true });

        const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
            cookies: {
                getAll() { return request.cookies.getAll(); },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, {
                            ...options,
                            path: "/",
                            sameSite: "lax",
                            secure: process.env.NODE_ENV === "production",
                            httpOnly: true,
                        });
                    });
                },
            },
        });

        const { error } = await supabase.auth.setSession({ access_token, refresh_token });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        return response;
    } catch (err) {
        console.error("Session sync error:", err);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const { supabaseUrl, supabaseAnonKey } = requireSupabaseBrowserEnv();
    const response = NextResponse.json({ success: true });

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() { return request.cookies.getAll(); },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, { ...options, path: "/" });
                });
            },
        },
    });

    await supabase.auth.signOut();
    return response;
}