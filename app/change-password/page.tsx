"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña tiene que tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password === "12345678") {
      setError("Elegí una contraseña distinta a la temporal.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/auth/complete-password-change", { method: "POST" });
    if (!res.ok) {
      setError("La contraseña se cambió pero no pudimos actualizar tu perfil. Recargá la página.");
      setLoading(false);
      return;
    }

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
      <div className="card" style={{ width: 400 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <Image src="/logo.png" alt="GML Contables" width={90} height={90} priority style={{ height: "auto" }} />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Elegí tu contraseña</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
          Es tu primer ingreso (o te blanquearon la clave). Definí una contraseña nueva
          para seguir usando el portal.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label className="label" htmlFor="password">Contraseña nueva</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="label" htmlFor="confirm">Repetí la contraseña</label>
            <input
              id="confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className="callout callout-error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
            {loading ? "Guardando..." : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </main>
  );
}
