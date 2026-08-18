import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UsersPanel } from "./UsersPanel";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const supabase = createSupabaseServerClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, force_password_change, created_at")
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>Socios</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
        Todos los socios tienen el mismo rol por ahora. Un alta nueva arranca con la
        contraseña temporal <code>12345678</code> y el sistema le va a pedir que la cambie
        al primer ingreso. Lo mismo pasa si le blanqueás la clave a alguien.
      </p>
      <UsersPanel initialUsers={profiles ?? []} />
    </div>
  );
}
