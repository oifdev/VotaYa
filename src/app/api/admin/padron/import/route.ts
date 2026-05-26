export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { badRequest, serverError } from "@/lib/api-response";
import { getRequestIp, writeAuditLog } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { identitySchema } from "@/lib/validators";

function cleanIdentity(value: string) {
  return value.replace(/\D/g, "");
}

function hashIdentity(cleaned: string) {
  return createHash("sha256").update(cleaned).digest("hex");
}

function maskIdentity(cleaned: string) {
  return `****-****-${cleaned.slice(-5)}`;
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function digitsOrText(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return { digits: "", formatted: value.trim() };

  // Excel often drops leading zeros when the cell is numeric. If the value is shorter
  // than 13 digits, we pad on the left as a best-effort recovery.
  const padded = digits.length < 13 ? digits.padStart(13, "0") : digits;
  const formatted =
    padded.length === 13
      ? padded.replace(/^(\d{4})(\d{4})(\d{5})$/, "$1-$2-$3")
      : value.trim();

  return { digits: padded, formatted };
}

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin.ok) return admin.response;

  try {
    const formData = await request.formData();
    const eleccionId = String(formData.get("eleccion_id") ?? "");
    const mode = String(formData.get("mode") ?? "upsert");
    const file = formData.get("file");

    if (!eleccionId) return badRequest("Seleccione una eleccion.");

    if (!(file instanceof File)) {
      return badRequest("Debe adjuntar un archivo Excel (.xlsx).");
    }

    const service = createSupabaseServiceClient();

    // Ownership gate: even with service role, only allow the logged-in admin to
    // manage padron entries for elections they own.
    const { data: election, error: electionError } = await service
      .from("elecciones")
      .select("id,nombre")
      .eq("id", eleccionId)
      .eq("organizer_id", admin.user.id)
      .maybeSingle();

    if (electionError) return badRequest(electionError.message);
    if (!election) return badRequest("La eleccion seleccionada no pertenece a su cuenta.");

    const buffer = await file.arrayBuffer();

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) return badRequest("El archivo no contiene hojas.");

    const headerRow = worksheet.getRow(1);
    const headers: Record<string, number> = {};
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = normalizeHeader(String(cell.text ?? ""));
      if (key) headers[key] = colNumber;
    });

    const nameKeys = [
      "nombre",
      "nombre completo",
      "nombre_completo",
      "nombres",
      "nombre y apellidos",
    ].map(normalizeHeader);
    const idKeys = [
      "identidad",
      "numero de identidad",
      "numero identidad",
      "no identidad",
      "dni",
      "cedula",
      "cédula",
      "id",
    ].map(normalizeHeader);

    const nameCol = nameKeys.map((key) => headers[key]).find(Boolean);
    const idCol = idKeys.map((key) => headers[key]).find(Boolean);

    if (!nameCol || !idCol) {
      return badRequest(
        'Encabezados invalidos. La primera fila debe incluir columnas "nombre_completo" y "identidad".',
      );
    }

    const errors: Array<{ row: number; message: string }> = [];
    const seen = new Set<string>();
    const rows: Array<{
      eleccion_id: string;
      nombre_completo: string;
      identidad_hash: string;
      identidad_masked: string;
      estado: "activo" | "inactivo";
    }> = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const rawName = String(row.getCell(nameCol).text ?? "").trim();
      const rawIdentity = String(row.getCell(idCol).text ?? "").trim();

      if (!rawName && !rawIdentity) return;
      if (!rawName) {
        errors.push({ row: rowNumber, message: "Falta nombre_completo." });
        return;
      }
      if (!rawIdentity) {
        errors.push({ row: rowNumber, message: "Falta identidad." });
        return;
      }

      const { digits, formatted } = digitsOrText(rawIdentity);

      try {
        const identidad = identitySchema.parse(formatted);
        const cleaned = cleanIdentity(identidad);
        const hash = hashIdentity(cleaned);

        if (seen.has(hash)) {
          errors.push({ row: rowNumber, message: "Identidad duplicada dentro del archivo." });
          return;
        }
        seen.add(hash);

        rows.push({
          eleccion_id: eleccionId,
          nombre_completo: normalizeName(rawName),
          identidad_hash: hash,
          identidad_masked: maskIdentity(digits || cleaned),
          estado: "activo",
        });
      } catch (err) {
        errors.push({
          row: rowNumber,
          message: err instanceof Error ? err.message : "Identidad invalida.",
        });
      }
    });

    if (!rows.length) {
      return badRequest("No se encontraron filas validas para importar.");
    }

    // Determine inserted vs updated (best-effort) before applying the upsert.
    const hashes = rows.map((r) => r.identidad_hash);
    const { data: existing, error: existingError } = await service
      .from("padron_votantes")
      .select("identidad_hash")
      .eq("eleccion_id", eleccionId)
      .in("identidad_hash", hashes);

    if (existingError) return badRequest(existingError.message);
    const existingSet = new Set((existing ?? []).map((r) => r.identidad_hash));

    const inserted = rows.filter((r) => !existingSet.has(r.identidad_hash)).length;
    const updated = rows.length - inserted;

    const shouldUpsert = mode !== "insert";

    const write = shouldUpsert
      ? service
          .from("padron_votantes")
          .upsert(rows, { onConflict: "eleccion_id,identidad_hash" })
      : service.from("padron_votantes").insert(rows);

    const { error: writeError } = await write;
    if (writeError) return badRequest(writeError.message);

    await writeAuditLog(service, {
      actorId: admin.user.id,
      action: "padron.imported",
      entityType: "padron_votante",
      entityId: null,
      metadata: {
        eleccion_id: eleccionId,
        election_nombre: election.nombre,
        inserted,
        updated,
        invalid: errors.length,
      },
      ipAddress: getRequestIp(request),
    });

    return NextResponse.json(
      {
        message: "Padron importado.",
        summary: {
          total_validas: rows.length,
          inserted,
          updated,
          invalid: errors.length,
        },
        errors: errors.slice(0, 50),
      },
      { status: 201 },
    );
  } catch (error) {
    return serverError(error);
  }
}
