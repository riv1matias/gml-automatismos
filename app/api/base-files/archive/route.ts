import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

// Permite volver a activar una version anterior (rollback), archivando la que
// estaba activa en ese momento. Util si se subio un archivo base por error.
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { versionId } = await req.json();
  if (!versionId) return NextResponse.json({ error: "Falta versionId" }, { status: 400 });

  const admin = createSupabaseAdminClient();

  const { data: target, error: targetError } = await admin
    .from("base_file_versions")
    .select("id, file_type, is_active")
    .eq("id", versionId)
    .single();

  if (targetError || !target) {
    return NextResponse.json({ error: "Version no encontrada" }, { status: 404 });
  }
  if (target.is_active) {
    return NextResponse.json({ error: "Esa version ya esta activa" }, { status: 400 });
  }

  const { data: currentActive } = await admin
    .from("base_file_versions")
    .select("id")
    .eq("file_type", target.file_type)
    .eq("is_active", true)
    .maybeSingle();

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
      metadata: { file_type: target.file_type, reason: "rollback" },
    });
  }

  await admin
    .from("base_file_versions")
    .update({ is_active: true, archived_at: null, archived_by: null })
    .eq("id", target.id);

  await logAudit(admin, {
    actorId: user.id,
    actorEmail: user.email ?? "",
    action: "upload_base_file",
    entity: "base_file_versions",
    entityId: target.id,
    metadata: { file_type: target.file_type, reason: "rollback_reactivated" },
  });

  return NextResponse.json({ ok: true });
}
