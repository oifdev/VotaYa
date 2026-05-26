export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth";
import { candidatePhotoBucket } from "@/lib/constants";
import { serverError } from "@/lib/api-response";

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { message: "Seleccione una fotografia valida." },
        { status: 400 },
      );
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      return NextResponse.json(
        { message: "La fotografia debe ser PNG, JPG o WebP." },
        { status: 400 },
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { message: "La fotografia no debe superar 5 MB." },
        { status: 400 },
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
    const path = `${admin.user.id}/candidates/${crypto.randomUUID()}-${safeName}`;

    const { error } = await admin.supabase.storage
      .from(candidatePhotoBucket)
      .upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    const { data } = admin.supabase.storage
      .from(candidatePhotoBucket)
      .getPublicUrl(path);

    return NextResponse.json({ publicUrl: data.publicUrl }, { status: 201 });
  } catch (error) {
    return serverError(error);
  }
}
