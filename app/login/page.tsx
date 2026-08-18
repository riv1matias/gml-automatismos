"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Email o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    // registra el login en la auditoria (best-effort, no bloquea el ingreso)
    await fetch("/api/auth/log-login", { method: "POST" }).catch(() => {});

    router.push("/");
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="card" style={{ width: 380 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <Image src="/logo.png" alt="GML Contables" width={120} height={120} priority style={{ height: "auto" }} />
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24, textAlign: "center" }}>
          Ingresá con tu cuenta de socio.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="callout callout-error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
