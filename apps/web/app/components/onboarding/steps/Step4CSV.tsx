"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { fetchWithAuthRetry } from "../../../../lib/api";

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

const BANKS = [
  { id: "BBVA",    label: "BBVA",     emoji: "🔵", hint: "Mis cuentas → Movimientos → Exportar CSV" },
  { id: "GALICIA", label: "Galicia",  emoji: "🟠", hint: "Resúmenes → Descargar movimientos → CSV" },
  { id: "BRUBANK", label: "Brubank",  emoji: "🟣", hint: "Actividad → Exportar → CSV" },
  { id: "SANTANDER", label: "Santander", emoji: "🔴", hint: "Próximamente compatible" },
  { id: "HSBC",    label: "HSBC",     emoji: "⬛", hint: "Próximamente compatible" },
];

const SUPPORTED = ["BBVA", "GALICIA", "BRUBANK"];

interface UploadResult { imported: number; duplicates: number; errors: string[] }

export function Step4CSV({ onNext, onSkip }: Props) {
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file || !selectedBank) return;

    setUploading(true);
    setProgress(20);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("provider", selectedBank);

      setProgress(50);
      const res = await fetchWithAuthRetry("/api/ingest/csv", {
        method: "POST",
        body: formData,
      });

      setProgress(90);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Error ${res.status}`);
      }

      const data: UploadResult = await res.json();
      setResult(data);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }, [selectedBank]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "text/plain": [".txt"] },
    maxFiles: 1,
    disabled: !selectedBank || !SUPPORTED.includes(selectedBank ?? "") || uploading,
  });

  return (
    <div className="flex flex-col gap-5 px-2">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-2">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-hi">Importá tu historial bancario</h2>
        <p className="text-sm text-mid leading-relaxed max-w-sm mx-auto">
          Subí el CSV de tu banco para tener todos tus movimientos desde el primer día.
        </p>
      </div>

      {/* Bank selector */}
      <div>
        <p className="text-xs font-semibold text-lo uppercase tracking-wider mb-2">Seleccioná tu banco</p>
        <div className="flex gap-2 flex-wrap">
          {BANKS.map((bank) => {
            const supported = SUPPORTED.includes(bank.id);
            return (
              <div key={bank.id} className="relative">
                <button
                  onClick={() => supported ? setSelectedBank(bank.id) : null}
                  onMouseEnter={() => setTooltip(bank.id)}
                  onMouseLeave={() => setTooltip(null)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    selectedBank === bank.id
                      ? "border-teal bg-teal/10 text-teal"
                      : supported
                      ? "border-border text-mid hover:border-hi hover:text-hi"
                      : "border-border/50 text-lo cursor-not-allowed opacity-50"
                  }`}
                >
                  <span>{bank.emoji}</span>
                  <span>{bank.label}</span>
                </button>
                {tooltip === bank.id && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-hi text-base text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg z-10">
                    {bank.hint}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-hi" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive
            ? "border-teal bg-teal/5"
            : selectedBank && SUPPORTED.includes(selectedBank)
            ? "border-border hover:border-teal hover:bg-teal/3"
            : "border-border/50 opacity-50 cursor-not-allowed"
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="space-y-3">
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-teal rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-mid">Subiendo y procesando…</p>
          </div>
        ) : (
          <>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-sm font-semibold text-hi">
              {isDragActive ? "Soltá el archivo acá" : "Arrastrá tu CSV o hacé click"}
            </p>
            <p className="text-xs text-lo mt-1">
              {selectedBank ? `CSV de ${selectedBank}` : "Primero seleccioná tu banco"}
            </p>
          </>
        )}
      </div>

      {result && (
        <div className="rounded-xl bg-success/8 border border-success/20 px-5 py-4">
          <p className="font-bold text-success text-sm mb-2">✅ Importación completada</p>
          <div className="flex gap-6 text-xs text-mid">
            <span><span className="font-bold text-hi text-base">{result.imported}</span> importadas</span>
            <span><span className="font-bold text-hi text-base">{result.duplicates}</span> duplicadas</span>
            {result.errors.length > 0 && <span><span className="font-bold text-danger text-base">{result.errors.length}</span> errores</span>}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-danger/8 border border-danger/20 px-4 py-3 text-sm text-danger">
          ⚠️ {error}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onSkip} className="flex-1 border border-border text-mid hover:text-hi hover:border-hi rounded-xl py-3 text-sm font-semibold transition-all">
          Omitir — lo hago después
        </button>
        <button onClick={onNext} className="flex-1 btn-primary py-3">
          {result ? "Continuar →" : "Omitir este paso →"}
        </button>
      </div>
    </div>
  );
}
