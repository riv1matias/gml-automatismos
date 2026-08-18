import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const TEMP_PASSWORD = "12345678";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user: actor } } = await supabase.auth.getUser();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { email, fullName } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Falta el email" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: fullName || email,
      force_password_change: true,
    },
  });

  if (error || !created.user) {
    return NextResponse.json({ error: error?.message ?? "No se pudo crear el usuario" }, { status: 500 });
  }

  // el trigger on_auth_user_created ya crea la fila en profiles; le sumamos quien lo dio de alta
  await admin.from("profiles").update({ created_by: actor.id }).eq("id", created.user.id);

  await logAudit(admin, {
    actorId: actor.id,
    actorEmail: actor.email ?? "",
    action: "create_user",
    entity: "profiles",
    entityId: created.user.id,
    metadata: { email },
  });

  return NextResponse.json({ ok: true, tempPassword: TEMP_PASSWORD });
}
