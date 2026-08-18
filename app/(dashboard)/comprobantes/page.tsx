import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProcessUploader } from "./ProcessUploader";

export const dynamic = "force-dynamic";

export default async function ComprobantesPage() {
  const supabase = createSupabaseServerClient();

  const [{ data: plantilla }, { data: proveedores }, { data: recentRuns }] = await Promise.all([
    supabase.from("base_file_versions").select("version_number, original_filename").eq("file_type", "plantilla").eq("is_active", true).maybeSingle(),
    supabase.from("base_file_versions").select("version_number, original_filename").eq("file_type", "proveedores").eq("is_active", true).maybeSingle(),
    supabase
      .from("comprobantes_runs")
      .select("id, period, version_number, status, row_count, warnings, processed_at, profiles:processed_by(email)")
      .order("processed_at", { ascending: false })
      .limit(5),
  ]);

  const readyToProcess = Boolean(plantilla) && Boolean(proveedores);
  const normalizedRuns: RunRow[] = (recentRuns ?? []).map((r) => ({
    ...r,
    profiles: Array.isArray(r.profiles) ? r.profiles[0] ?? null : r.profiles,
  }));

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>Automatismo Comprobantes</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
        Subí el comprobante crudo de AFIP (CSV o Excel) para un período y generá el archivo final.
      </p>

      {!readyToProcess && (
        <div className="callout callout-warning" style={{ marginBottom: 20 }}>
          Todavía falta cargar el archivo base de {!plantilla && "Plantilla"}
          {!plantilla && !proveedores && " y "}
          {!proveedores && "Proveedores"} en{" "}
          <Link href="/archivos-base">Archivos base</Link> antes de poder procesar.
        </div>
      )}

      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 24, marginBottom: 20, fontSize: 13, color: "var(--text-muted)" }}>
          <div>Plantilla activa: <strong>{plantilla ? `v${plantilla.version_number}` : "sin cargar"}</strong></div>
          <div>Proveedores activo: <strong>{proveedores ? `v${proveedores.version_number}` : "sin cargar"}</strong></div>
        </div>
        <ProcessUploader disabled={!readyToProcess} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 500 }}>Últimas corridas</h2>
        <Link href="/comprobantes/historial" style={{ fontSize: 14 }}>Ver historial completo →</Link>
      </div>
      <RunsTable runs={normalizedRuns} />
    </div>
  );
}

interface RunRow {
  id: string;
  period: string;
  version_number: number;
  status: string;
  row_count: number | null;
  warnings: unknown[];
  processed_at: string;
  profiles: { email: string } | null;
}

export function RunsTable({ runs }: { runs: RunRow[] }) {
  if (runs.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Todavía no se procesó ningún período.</p>;
  }

  return (
    <div className="card" style={{ padding: 0 }}>
      <table>
        <thead>
          <tr>
            <th>Período</th>
            <th>Versión</th>
            <th>Filas</th>
            <th>Estado</th>
            <th>Procesado por</th>
            <th>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td>{r.period}</td>
              <td>v{r.version_number}</td>
              <td>{r.row_count ?? "—"}</td>
              <td>
                {r.status === "done" && Array.isArray(r.warnings) && r.warnings.length > 0 && (
                  <span className="badge badge-warning">Con avisos ({r.warnings.length})</span>
                )}
                {r.status === "done" && (!Array.isArray(r.warnings) || r.warnings.length === 0) && (
                  <span className="badge badge-done">Lista</span>
                )}
                {r.status === "processing" && <span className="badge badge-warning">Procesando</span>}
                {r.status === "error" && <span className="badge badge-error">Error</span>}
              </td>
              <td>{r.profiles?.email ?? "—"}</td>
              <td>{new Date(r.processed_at).toLocaleString("es-AR")}</td>
              <td>
                {r.status === "done" && (
                  <a href={`/api/comprobantes/download?runId=${r.id}`} className="btn btn-secondary" style={{ padding: "5px 12px", fontSize: 13 }}>
                    Descargar
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
