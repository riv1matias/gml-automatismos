import { createBrowserClient } from "@supabase/ssr";

// Cliente para usar en Client Components. Usa la anon key (segura para exponer),
// las policies de RLS son las que realmente protegen los datos.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
