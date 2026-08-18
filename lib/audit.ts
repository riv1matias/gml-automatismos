import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "login"
  | "change_password"
  | "create_user"
  | "reset_password"
  | "upload_base_file"
  | "archive_base_file"
  | "process_comprobantes"
  | "download_result";

export async function logAudit(
  supabase: SupabaseClient,
  params: {
    actorId: string;
    actorEmail: string;
    action: AuditAction;
    entity?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from("audit_log").insert({
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    action: params.action,
    entity: params.entity ?? null,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });
  // la auditoria nunca debe tirar abajo la operacion principal: solo se loguea el error
  if (error) console.error("No se pudo escribir en audit_log:", error.message);
}
