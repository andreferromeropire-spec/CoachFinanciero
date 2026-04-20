"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import { useDropzone } from "react-dropzone";
import { fetcher, apiFetch } from "../../lib/api";
import { TransactionRow } from "../components/TransactionRow";

const PAGE_SIZE = 20;
const PROVIDERS = ["BBVA", "GALICIA", "BRUBANK"];
const CATEGORIES = [
  "", "Sin categorizar", "Supermercado", "Combustible", "Restaurantes",
  "Suscripciones", "Salud", "Transporte", "Servicios", "Compras",
  "Entretenimiento", "Transferencias", "Finanzas", "Viajes", "Educación",
];
const SOURCES = ["", "EMAIL", "API", "CSV", "MANUAL"];

interface Filters {
  page: number;
  category: string;
  source: string;
  from: string;
  to: string;
  search: string;
}

interface TxData {
  data: {
    id: string;
    amount: string;
    currency: string;
    description?: string;
    merchant?: string;
    category?: string;
    date: string;
    source: string;
    account?: { name: string; provider: string };
  }[];
  meta: { total: number; page: number; totalPages: number };
}

export default function TransactionsPage() {
  const [filters, setFilters] = useState<Filters>({
    page: 1, category: "", source: "", from: "", to: "", search: "",
  });

  const [csvProvider, setCsvProvider] = useState("BBVA");
  const [uploadResult, setUploadResult] = useState<{ imported: number; duplicates: number; errors: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);

  const query = new URLSearchParams({
    page: String(filters.page),
    ...(filters.category && { category: filters.category }),
    ...(filters.source && { source: filters.source }),
    ...(filters.from && { from: filters.from }),
    ...(filters.to && { to: filters.to }),
    ...(filters.search && { search: filters.search }),
  }).toString();

  const { data, mutate } = useSWR<TxData>(`/api/transactions?${query}`, fetcher);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? (value as number) : 1 }));
  }

  async function handleCategoryChange(id: string, category: string) {
    await apiFetch(`/api/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ category }),
    });
    mutate();
  }

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setUploading(true);
      setUploadResult(null);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("provider", csvProvider);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/ingest/csv`,
          { method: "POST", body: form }
        );
        const result = await res.json();
        setUploadResult(result);
        mutate();
      } catch {
        setUploadResult({ imported: 0, duplicates: 0, errors: ["Error al subir el archivo"] });
      } finally {
        setUploading(false);
      }
    },
    [csvProvider, mutate]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "text/plain": [".txt"] },
    maxFiles: 1,
  });

  const meta = data?.meta;
  const hasActiveFilters = !!(filters.category || filters.source || filters.from || filters.to || filters.search);

  return (
    <div className="px-4 py-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-[2rem] font-bold text-hi tracking-tight leading-none">Transacciones</h1>
        <p className="text-mid text-xs md:text-sm mt-1 font-medium">
          {meta?.total ?? 0} transacciones en total
        </p>
      </div>

      {/* CSV Upload */}
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <h2 className="text-sm font-bold text-hi">Importar CSV</h2>
        </div>

        <div className="flex gap-4 items-start">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-mid uppercase tracking-wide">Banco</label>
            <select
              value={csvProvider}
              onChange={(e) => setCsvProvider(e.target.value)}
              className="select-light"
            >
              {PROVIDERS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>

          <div className="flex-1">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
                isDragActive
                  ? "border-teal bg-teal/5 text-teal"
                  : "border-border text-lo hover:border-teal/50 hover:bg-raised/50"
              }`}
            >
              <input {...getInputProps()} />
              {uploading ? (
                <p className="text-sm text-warning font-medium">Procesando...</p>
              ) : isDragActive ? (
                <p className="text-sm font-semibold">Suelta el archivo aquí ✓</p>
              ) : (
                <p className="text-sm">Arrastra el CSV aquí o <span className="text-teal font-semibold">haz clic para seleccionar</span></p>
              )}
            </div>
          </div>
        </div>

        {uploadResult && (
          <div className={`mt-4 text-sm rounded-xl px-4 py-3 border font-medium ${
            uploadResult.errors.length > 0
              ? "bg-danger/8 text-danger border-danger/20"
              : "bg-success/8 text-success border-success/20"
          }`}>
            ✓ {uploadResult.imported} importadas · {uploadResult.duplicates} duplicadas
            {uploadResult.errors.length > 0 && ` · ${uploadResult.errors.length} errores`}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card p-3 md:p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
          <input
            type="text"
            placeholder="Buscar..."
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className="input-light col-span-2 md:col-span-1"
          />
          <select
            value={filters.category}
            onChange={(e) => setFilter("category", e.target.value)}
            className="select-light"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIES.filter(Boolean).map((c) => <option key={c}>{c}</option>)}
          </select>
          <select
            value={filters.source}
            onChange={(e) => setFilter("source", e.target.value)}
            className="select-light"
          >
            <option value="">Todas las fuentes</option>
            {SOURCES.filter(Boolean).map((s) => <option key={s}>{s}</option>)}
          </select>
          <div className="flex gap-2 col-span-2 md:col-span-1">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilter("from", e.target.value)}
              placeholder="Desde"
              className="input-light flex-1 min-w-0"
            />
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilter("to", e.target.value)}
              placeholder="Hasta"
              className="input-light flex-1 min-w-0"
            />
          </div>
        </div>
        {hasActiveFilters && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => setFilters({ page: 1, category: "", source: "", from: "", to: "", search: "" })}
              className="text-xs text-danger hover:text-danger/80 font-semibold px-3 py-1.5 rounded-lg
                         bg-danger/8 border border-danger/15 hover:bg-danger/12 transition-colors"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-raised/40">
              <th className="px-3 md:px-5 py-3 text-left text-[11px] font-semibold text-lo uppercase tracking-wider">Fecha</th>
              <th className="px-3 md:px-4 py-3 text-left text-[11px] font-semibold text-lo uppercase tracking-wider">Descripción</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-[11px] font-semibold text-lo uppercase tracking-wider">Categoría</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-[11px] font-semibold text-lo uppercase tracking-wider">Fuente</th>
              <th className="px-3 md:px-5 py-3 text-right text-[11px] font-semibold text-lo uppercase tracking-wider">Monto</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} onCategoryChange={handleCategoryChange} />
            ))}
            {(!data || data.data.length === 0) && (
              <tr>
                <td colSpan={5} className="text-center py-16 text-lo text-sm">
                  No hay transacciones con estos filtros
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            disabled={filters.page <= 1}
            onClick={() => setFilter("page", filters.page - 1)}
            className="px-4 py-2 text-sm bg-white border border-border rounded-xl hover:bg-raised
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-hi"
          >
            ← Anterior
          </button>
          <span className="text-sm text-mid font-medium">
            {filters.page} / {meta.totalPages}
          </span>
          <button
            disabled={filters.page >= meta.totalPages}
            onClick={() => setFilter("page", filters.page + 1)}
            className="px-4 py-2 text-sm bg-white border border-border rounded-xl hover:bg-raised
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-hi"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
