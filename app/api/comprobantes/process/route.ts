import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { parseRawFile, RawParseError } from "@/lib/transform/parseRaw";
import { mapToFinalRows } from "@/lib/transform/mapping";
import { buildFinalWorkbook } from "@/lib/transform/buildWorkbook";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const period = form.get("period");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo de comprobantes" }, { status: 400 });
  }
  if (typeof period !== "string" || !/^\d{6}$/.test(period)) {
    return NextResponse.json({ error: "El período tiene que tener formato AAAAMM, ej 202608" }, { status: 400 });
  }
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
    return NextResponse.json({ error: "Formato no soportado, subí un .csv o .xlsx" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const [{ data: plantillaVersion }, { data: proveedoresVersion }] = await Promise.all([
    admin.from("base_file_versions").select("id, storage_path").eq("file_type", "plantilla").eq("is_active", true).maybeSingle(),
    admin.from("base_file_versions").select("id, storage_path").eq("file_type", "proveedores").eq("is_active", true).maybeSingle(),
  ]);

  if (!plantillaVersion || !proveedoresVersion) {
    return NextResponse.json(
      { error: "Falta cargar el archivo base de Plantilla y/o Proveedores antes de procesar." },
      { status: 400 }
    );
  }

  const { data: lastRun } = await admin
    .from("comprobantes_runs")
    .select("version_number")
    .eq("period", period)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const versionNumber = (lastRun?.version_number ?? 0) + 1;

  const inputBytes = Buffer.from(await file.arrayBuffer());
  const inputPath = `input/${period}/v${versionNumber}_${Date.now()}_${file.name}`;

  const { error: inputUploadError } = await admin.storage.from("comprobantes").upload(inputPath, inputBytes);
  if (inputUploadError) {
    return NextResponse.json({ error: `No se pudo guardar el archivo subido: ${inputUploadError.message}` }, { status: 500 });
  }

  const { data: runInsert, error: runInsertError } = await admin
    .from("comprobantes_runs")
    .insert({
      period,
      version_number: versionNumber,
      input_storage_path: inputPath,
      input_original_filename: file.name,
      status: "processing",
      proveedores_version_id: proveedoresVersion.id,
      plantilla_version_id: plantillaVersion.id,
      processed_by: user.id,
    })
    .select("id")
    .single();

  if (runInsertError || !runInsert) {
    return NextResponse.json({ error: runInsertError?.message ?? "No se pudo crear la corrida" }, { status: 500 });
  }

  const runId = runInsert.id;

  try {
    const rawRecords = await parseRawFile(inputBytes, file.name);
    if (rawRecords.length === 0) {
      throw new RawParseError("El archivo no tiene filas de comprobantes.");
    }

    const { finalRows, warnings } = mapToFinalRows(rawRecords);

    const { data: provFile, error: provDownloadError } = await admin.storage
      .from("base-files")
      .download(proveedoresVersion.storage_path);
    if (provDownloadError || !provFile) {
      throw new Error(`No se pudo leer el archivo base de Proveedores: ${provDownloadError?.message}`);
    }
    const provBuffer = Buffer.from(await provFile.arrayBuffer());

    const outputBuffer = await buildFinalWorkbook(rawRecords, finalRows, provBuffer);

    const outputPath = `output/${period}/v${versionNumber}_${Date.now()}.xlsx`;
    const { error: outputUploadError } = await admin.storage.from("comprobantes").upload(outputPath, outputBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (outputUploadError) throw new Error(outputUploadError.message);

    await admin
      .from("comprobantes_runs")
      .update({
        status: "done",
        output_storage_path: outputPath,
        row_count: finalRows.length,
        warnings,
      })
      .eq("id", runId);

    await logAudit(admin, {
      actorId: user.id,
      actorEmail: user.email ?? "",
      action: "process_comprobantes",
      entity: "comprobantes_runs",
      entityId: runId,
      metadata: { period, version_number: versionNumber, row_count: finalRows.length, warning_count: warnings.length },
    });

    return NextResponse.json({ ok: true, runId, rowCount: finalRows.length, warnings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido procesando el archivo";
    await admin.from("comprobantes_runs").update({ status: "error", error_message: message }).eq("id", runId);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
