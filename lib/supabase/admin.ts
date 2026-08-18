import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la service role key: se salta RLS y puede administrar usuarios
// (auth.admin.*) y storage. SOLO se importa desde Route Handlers / server code.
// SUPABASE_SERVICE_ROLE_KEY nunca debe tener el prefijo NEXT_PUBLIC_.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
