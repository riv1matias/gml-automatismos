"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Warning {
  rowIndex: number;
  denominacion: string;
  nroDocVend: number;
  importeTotal: number;
  totalCalculado: number;
  diferencia: number;
  mensaje: string;
}

function currentPeriodDefault() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

export function ProcessUploader({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [period, setPeriod] = useState(currentPeriodDefault());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ runId: string; rowCount: number; warnings: Warning[] } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Elegí un archivo primero.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("period", period);

    const res = await fetch("/api/comprobantes/process", { method: "POST", body: form });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo procesar el archivo.");
      return;
    }

    setResult({ runId: data.runId, rowCount: data.rowCount, warnings: data.warnings ?? [] });
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label className="label" htmlFor="period">Período (AAAAMM)</label>
          <input
            id="period"
            type="text"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            pattern="\d{6}"
            style={{ width: 120 }}
            disabled={disabled}
          />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label className="label" htmlFor="file">Comprobante crudo (CSV o Excel)</label>
          <input ref={inputRef} id="file" type="file" accept=".csv,.xlsx,.xls" disabled={disabled} />
        </div>
        <button type="submit" className="btn" disabled={disabled || loading}>
          {loading ? "Procesando..." : "Procesar"}
        </button>
      </form>

      {error && (
        <div className="callout callout-error" style={{ marginTop: 16 }}>{error}</div>
      )}

      {result && (
        <div style={{ marginTop: 16 }}>
          <div className="callout callout-success" style={{ marginBottom: result.warnings.length ? 10 : 0 }}>
            Se procesaron {result.rowCount} comprobantes.{" "}
            <a href={`/api/comprobantes/download?runId=${result.runId}`}>Descargar archivo final</a>
          </div>

          {result.warnings.length > 0 && (
            <div className="callout callout-warning">
              <strong>{result.warnings.length} comprobante(s) para revisar a mano:</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {result.warnings.map((w) => (
                  <li key={w.rowIndex} style={{ marginBottom: 4 }}>
                    Fila {w.rowIndex} — {w.denominacion} (CUIT {w.nroDocVend}): {w.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
