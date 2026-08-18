import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RunsTable } from "../page";

export const dynamic = "force-dynamic";

export default async function HistorialPage() {
  const supabase = createSupabaseServerClient();
  const { data: runs } = await supabase
    .from("comprobantes_runs")
    .select("id, period, version_number, status, row_count, warnings, processed_at, profiles:processed_by(email)")
    .order("processed_at", { ascending: false })
    .limit(200);

  const normalizedRuns = (runs ?? []).map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles,
  }));

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <Link href="/comprobantes" style={{ fontSize: 13 }}>← Volver al módulo</Link>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>Historial de corridas</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
        Todas las corridas quedan guardadas, incluso las que dieron error. Cada descarga se
        registra en la auditoría con quién y cuándo.
      </p>
      <RunsTable runs={normalizedRuns} />
    </div>
  );
}
