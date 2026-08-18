import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BaseFileUploader } from "./BaseFileUploader";

export const dynamic = "force-dynamic";

async function getVersions(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  fileType: string
): Promise<VersionRow[]> {
  const { data } = await supabase
    .from("base_file_versions")
    .select("id, version_number, original_filename, is_active, uploaded_at, archived_at, notes, profiles:uploaded_by(email)")
    .eq("file_type", fileType)
    .order("version_number", { ascending: false });

  return (data ?? []).map((row) => ({
    ...row,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles,
  })) as VersionRow[];
}

export default async function ArchivosBasePage() {
  const supabase = createSupabaseServerClient();
  const [proveedores, plantilla] = await Promise.all([
    getVersions(supabase, "proveedores"),
    getVersions(supabase, "plantilla"),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>Archivos base</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 28 }}>
        Proveedores y Plantilla son estáticos: siempre se usa la versión activa. Al subir uno
        nuevo, el anterior queda archivado (no se pierde, se puede consultar el historial).
      </p>

      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 17, fontWeight: 500, marginBottom: 12 }}>Proveedores</h2>
        <BaseFileUploader fileType="proveedores" />
        <VersionsTable versions={proveedores} />
      </section>

      <section>
        <h2 style={{ fontSize: 17, fontWeight: 500, marginBottom: 12 }}>Plantilla</h2>
        <BaseFileUploader fileType="plantilla" />
        <VersionsTable versions={plantilla} />
      </section>
    </div>
  );
}

interface VersionRow {
  id: string;
  version_number: number;
  original_filename: string;
  is_active: boolean;
  uploaded_at: string;
  archived_at: string | null;
  notes: string | null;
  profiles: { email: string } | null;
}

function VersionsTable({ versions }: { versions: VersionRow[] }) {
  if (versions.length === 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Todavía no se subió ningún archivo.</p>;
  }

  return (
    <div className="card" style={{ padding: 0, marginTop: 12 }}>
      <table>
        <thead>
          <tr>
            <th>Versión</th>
            <th>Archivo</th>
            <th>Subido por</th>
            <th>Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.id}>
              <td>v{v.version_number}</td>
              <td>{v.original_filename}</td>
              <td>{v.profiles?.email ?? "—"}</td>
              <td>{new Date(v.uploaded_at).toLocaleString("es-AR")}</td>
              <td>
                {v.is_active ? (
                  <span className="badge badge-active">Activa</span>
                ) : (
                  <span className="badge badge-archived">Archivada</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
