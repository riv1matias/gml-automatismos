"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface ModuleLink {
  code: string;
  name: string;
  href: string;
}

const MODULES: ModuleLink[] = [
  { code: "comprobantes", name: "Automatismo Comprobantes", href: "/comprobantes" },
];

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const linkStyle = (href: string): React.CSSProperties => ({
    display: "block",
    padding: "9px 14px",
    borderRadius: 8,
    color: pathname.startsWith(href) ? "var(--accent-contrast)" : "var(--text)",
    background: pathname.startsWith(href) ? "var(--accent)" : "transparent",
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 4,
  });

  return (
    <nav
      style={{
        width: 240,
        minHeight: "100vh",
        borderRight: "1px solid var(--border)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
        <Image src="/logo.png" alt="GML Contables" width={34} height={34} style={{ borderRadius: 6 }} />
        <div>
          <div style={{ fontWeight: 500, fontSize: 14 }}>Portal GML</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{email}</div>
        </div>
      </div>

      <Link href="/" style={linkStyle("/")}>Inicio</Link>

      <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "16px 0 6px", textTransform: "uppercase" }}>
        Módulos
      </div>
      {MODULES.map((m) => (
        <Link key={m.code} href={m.href} style={linkStyle(m.href)}>{m.name}</Link>
      ))}

      <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "16px 0 6px", textTransform: "uppercase" }}>
        Administración
      </div>
      <Link href="/archivos-base" style={linkStyle("/archivos-base")}>Archivos base</Link>
      <Link href="/usuarios" style={linkStyle("/usuarios")}>Socios</Link>

      <div style={{ flex: 1 }} />

      <button onClick={handleLogout} className="btn btn-secondary" style={{ justifyContent: "center" }}>
        Cerrar sesión
      </button>
    </nav>
  );
}
