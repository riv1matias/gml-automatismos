"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  force_password_change: boolean;
  created_at: string;
}

export function UsersPanel({ initialUsers }: { initialUsers: Profile[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fullName }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo crear el socio.");
      return;
    }

    setNotice(`Socio creado. Contraseña temporal: ${data.tempPassword}`);
    setEmail("");
    setFullName("");
    router.refresh();
  }

  async function handleReset(userId: string) {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "No se pudo blanquear la contraseña.");
      return;
    }
    setNotice(`Contraseña blanqueada. Nueva contraseña temporal: ${data.tempPassword}`);
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="card" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="label" htmlFor="new-name">Nombre</label>
          <input id="new-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label className="label" htmlFor="new-email">Email</label>
          <input id="new-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Creando..." : "Dar de alta socio"}
        </button>
      </form>

      {error && <div className="callout callout-error" style={{ marginBottom: 16 }}>{error}</div>}
      {notice && <div className="callout callout-success" style={{ marginBottom: 16 }}>{notice}</div>}

      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Estado</th>
              <th>Alta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initialUsers.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name ?? "—"}</td>
                <td>{u.email}</td>
                <td>
                  {u.force_password_change ? (
                    <span className="badge badge-warning">Clave temporal pendiente</span>
                  ) : (
                    <span className="badge badge-active">Activo</span>
                  )}
                </td>
                <td>{new Date(u.created_at).toLocaleDateString("es-AR")}</td>
                <td>
                  <button className="btn btn-secondary" style={{ padding: "5px 12px", fontSize: 13 }} onClick={() => handleReset(u.id)}>
                    Blanquear contraseña
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
