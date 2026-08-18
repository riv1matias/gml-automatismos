import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: modules } = await supabase
    .from("modules")
    .select("code, name, description")
    .eq("enabled", true)
    .order("sort_order");

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>Inicio</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 28 }}>
        Elegí un módulo para trabajar.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {(modules ?? []).map((m) => (
          <Link key={m.code} href={`/${m.code}`} className="card" style={{ display: "block" }}>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>{m.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{m.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
