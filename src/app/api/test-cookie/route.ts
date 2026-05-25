import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
    const cookieStore = await cookies();
    cookieStore.set("test-cookie-vercel", "hello", { path: "/" });
    
    return NextResponse.json({ success: true });
}
