import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const VALID_TYPES = ["proveedores", "plantilla"] as const;
type FileType = (typeof VALID_TYPES)[number];

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const fileType = form.get("file_type");
  const notes = form.get("notes");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (typeof fileType !== "string" || !VALID_TYPES.includes(fileType as FileType)) {
    return NextResponse.json({ error: "file_type invalido" }, { status: 400 });
  }
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    return NextResponse.json({ error: "El archivo base tiene que ser .xlsx" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // version actual activa (si hay) para archivarla
  const { data: currentActive } = await admin
    .from("base_file_versions")
    .select("id, version_number")
    .eq("file_type", fileType)
    .eq("is_active", true)
    .maybeSingle();

  const { data: lastVersion } = await admin
    .from("base_file_versions")
    .select("version_number")
    .eq("file_type", fileType)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (lastVersion?.version_number ?? 0) + 1;
  const storagePath = `${fileType}/v${nextVersion}_${Date.now()}_${file.name}`;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from("base-files")
    .upload(storagePath, bytes, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

  if (uploadError) {
    return NextResponse.json({ error: `Error subiendo el archivo: ${uploadError.message}` }, { status: 500 });
  }

  if (currentActive) {
    await admin
      .from("base_file_versions")
      .update({ is_active: false, archived_at: new Date().toISOString(), archived_by: user.id })
      .eq("id", currentActive.id);

    await logAudit(admin, {
      actorId: user.id,
      actorEmail: user.email ?? "",
      action: "archive_base_file",
      entity: "base_file_versions",
      entityId: currentActive.id,
      metadata: { file_type: fileType, replaced_by_version: nextVersion },
    });
  }

  const { data: inserted, error: insertError } = await admin
    .from("base_file_versions")
    .insert({
      file_type: fileType,
      version_number: nextVersion,
      storage_path: storagePath,
      original_filename: file.name,
      is_active: true,
      uploaded_by: user.id,
      notes: typeof notes === "string" && notes ? notes : null,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await logAudit(admin, {
    actorId: user.id,
    actorEmail: user.email ?? "",
    action: "upload_base_file",
    entity: "base_file_versions",
    entityId: inserted.id,
    metadata: { file_type: fileType, version_number: nextVersion, filename: file.name },
  });

  return NextResponse.json({ ok: true, versionId: inserted.id, versionNumber: nextVersion });
}
