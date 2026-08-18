"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function BaseFileUploader({ fileType }: { fileType: "proveedores" | "plantilla" }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("file_type", fileType);

    const res = await fetch("/api/base-files/upload", { method: "POST", body: form });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo subir el archivo.");
      return;
    }

    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ maxWidth: 320 }} />
      <button className="btn" onClick={handleUpload} disabled={loading}>
        {loading ? "Subiendo..." : "Subir nueva versión"}
      </button>
      {error && <span style={{ color: "var(--danger)", fontSize: 13 }}>{error}</span>}
    </div>
  );
}
