import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

const TEMP_PASSWORD = "12345678";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user: actor } } = await supabase.auth.getUser();
  if (!actor) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "Falta userId" }, { status: 400 });

  const admin = createSupabaseAdminClient();

  const { error } = await admin.auth.admin.updateUserById(userId, { password: TEMP_PASSWORD });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("profiles").update({ force_password_change: true }).eq("id", userId);

  await logAudit(admin, {
    actorId: actor.id,
    actorEmail: actor.email ?? "",
    action: "reset_password",
    entity: "profiles",
    entityId: userId,
  });

  return NextResponse.json({ ok: true, tempPassword: TEMP_PASSWORD });
}
