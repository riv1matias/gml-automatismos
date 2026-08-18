import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "Falta runId" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data: run, error } = await admin
    .from("comprobantes_runs")
    .select("id, period, version_number, output_storage_path, status")
    .eq("id", runId)
    .single();

  if (error || !run || !run.output_storage_path || run.status !== "done") {
    return NextResponse.json({ error: "El archivo final no está disponible para esta corrida." }, { status: 404 });
  }

  const { data: file, error: downloadError } = await admin.storage
    .from("comprobantes")
    .download(run.output_storage_path);

  if (downloadError || !file) {
    return NextResponse.json({ error: "No se pudo leer el archivo desde el storage." }, { status: 500 });
  }

  // auditoria: quien descargo, que corrida, en que momento (hora exacta = created_at)
  await logAudit(admin, {
    actorId: user.id,
    actorEmail: user.email ?? "",
    action: "download_result",
    entity: "comprobantes_runs",
    entityId: run.id,
    metadata: { period: run.period, version_number: run.version_number },
  });

  const filename = `comprobantes_${run.period}_v${run.version_number}_final.xlsx`;
  const arrayBuffer = await file.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
