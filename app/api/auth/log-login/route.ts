import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  await logAudit(supabase, {
    actorId: user.id,
    actorEmail: user.email ?? "",
    action: "login",
  });

  return NextResponse.json({ ok: true });
}
