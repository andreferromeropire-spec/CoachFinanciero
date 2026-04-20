import { parse } from "csv-parse/sync";
import { normalize } from "./MerchantNormalizer";

export interface ParsedRow {
  date: Date;
  description: string;
  amount: number;
  currency: string;
  merchantNormalized: string;
}

// ── BBVA Argentina CSV export ─────────────────────────────────────────────────
// Typical format: Fecha;Descripcion;Referencia;Debitos;Creditos;Saldo
function parseBBVA(content: string): ParsedRow[] {
  const records = parse(content, { delimiter: ";", skip_empty_lines: true, from_line: 1 });

  const results: ParsedRow[] = [];
  let headerFound = false;
  let dateIdx = -1, descIdx = -1, debitIdx = -1, creditIdx = -1;

  for (const row of records as string[][]) {
    if (!headerFound) {
      const normalized = row.map((c) => c.toLowerCase().trim());
      if (normalized.some((c) => c.includes("fecha"))) {
        dateIdx = normalized.findIndex((c) => c.includes("fecha"));
        descIdx = normalized.findIndex((c) => c.includes("descripci") || c.includes("concepto"));
        debitIdx = normalized.findIndex((c) => c.includes("d\u00e9bito") || c.includes("debito"));
        creditIdx = normalized.findIndex((c) => c.includes("cr\u00e9dito") || c.includes("credito"));
        headerFound = true;
      }
      continue;
    }

    if (dateIdx < 0 || !row[dateIdx]) continue;

    const rawDate = row[dateIdx]?.trim();
    const parsedDate = parseArgDate(rawDate);
    if (!parsedDate) continue;

    const description = row[descIdx]?.trim() ?? "";
    const debit = parseAmount(row[debitIdx]);
    const credit = parseAmount(row[creditIdx]);
    const amount = credit > 0 ? credit : -debit;

    if (amount === 0) continue;

    results.push({ date: parsedDate, description, amount, currency: "ARS", merchantNormalized: normalize(description) });
  }

  return results;
}

// ── Galicia CSV export ─────────────────────────────────────────────────────────
// Format: Fecha,Descripcion,Referencia,Monto
function parseGalicia(content: string): ParsedRow[] {
  const records = parse(content, { delimiter: ",", skip_empty_lines: true, from_line: 1 });

  const results: ParsedRow[] = [];
  let headerFound = false;
  let dateIdx = -1, descIdx = -1, amountIdx = -1;

  for (const row of records as string[][]) {
    if (!headerFound) {
      const normalized = row.map((c) => c.toLowerCase().trim());
      if (normalized.some((c) => c.includes("fecha"))) {
        dateIdx = normalized.findIndex((c) => c.includes("fecha"));
        descIdx = normalized.findIndex((c) => c.includes("descripci") || c.includes("concepto"));
        amountIdx = normalized.findIndex(
          (c) => c.includes("monto") || c.includes("importe") || c.includes("amount")
        );
        headerFound = true;
      }
      continue;
    }

    if (!row[dateIdx]) continue;
    const parsedDate = parseArgDate(row[dateIdx]?.trim());
    if (!parsedDate) continue;

    const amount = parseAmount(row[amountIdx]);
    if (amount === 0) continue;

    const desc = row[descIdx]?.trim() ?? "";
    results.push({ date: parsedDate, description: desc, amount, currency: "ARS", merchantNormalized: normalize(desc) });
  }

  return results;
}

// ── Brubank CSV export ─────────────────────────────────────────────────────────
// Format: Fecha,Tipo,Descripcion,Monto
function parseBrubank(content: string): ParsedRow[] {
  const records = parse(content, { delimiter: ",", skip_empty_lines: true, from_line: 1 });

  const results: ParsedRow[] = [];
  let headerFound = false;
  let dateIdx = -1, descIdx = -1, amountIdx = -1, typeIdx = -1;

  for (const row of records as string[][]) {
    if (!headerFound) {
      const normalized = row.map((c) => c.toLowerCase().trim());
      if (normalized.some((c) => c.includes("fecha"))) {
        dateIdx = normalized.findIndex((c) => c.includes("fecha"));
        typeIdx = normalized.findIndex((c) => c.includes("tipo"));
        descIdx = normalized.findIndex((c) => c.includes("descripci") || c.includes("detalle"));
        amountIdx = normalized.findIndex((c) => c.includes("monto") || c.includes("importe"));
        headerFound = true;
      }
      continue;
    }

    if (!row[dateIdx]) continue;
    const parsedDate = parseArgDate(row[dateIdx]?.trim());
    if (!parsedDate) continue;

    let amount = parseAmount(row[amountIdx]);
    const type = row[typeIdx]?.toLowerCase() ?? "";
    // Brubank labels debits as "débito" or "compra", credits as "crédito" or "recibido"
    if (type.includes("d\u00e9bito") || type.includes("compra") || type.includes("debito")) {
      amount = -Math.abs(amount);
    } else if (type.includes("cr\u00e9dito") || type.includes("credito") || type.includes("recibido")) {
      amount = Math.abs(amount);
    }

    if (amount === 0) continue;

    const desc = row[descIdx]?.trim() ?? row[typeIdx]?.trim() ?? "";
    results.push({ date: parsedDate, description: desc, amount, currency: "ARS", merchantNormalized: normalize(desc) });
  }

  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArgDate(raw: string | undefined): Date | null {
  if (!raw) return null;

  // dd/mm/yyyy
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`);

  // yyyy-mm-dd
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(raw);

  return null;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type CsvProvider = "BBVA" | "GALICIA" | "BRUBANK";

export function parseCsv(content: string, provider: CsvProvider): ParsedRow[] {
  switch (provider) {
    case "BBVA":
      return parseBBVA(content);
    case "GALICIA":
      return parseGalicia(content);
    case "BRUBANK":
      return parseBrubank(content);
  }
}
