import { normalize, merchantToCategory } from "./MerchantNormalizer";
import { categorizeByItems, type InvoiceItem } from "./CategoryMapper";

export interface ParsedEmail {
  amount: number;
  currency: string;
  description: string;
  merchant: string | null;
  merchantNormalized: string | null;
  date: Date;
  accountHint: string | null;
  category: string | null;
  items?: InvoiceItem[];
}

interface RawEmail {
  from: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
}

type Parser = (email: RawEmail) => ParsedEmail | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArgDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`);
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return new Date(raw);
  return null;
}

function parseAmount(raw: string | undefined): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

/** Extrae ítems de una tabla HTML con columnas nombre/precio */
function extractItemsFromHtml(html: string): InvoiceItem[] {
  const items: InvoiceItem[] = [];
  // Match <tr> rows that contain a price-like pattern
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const row = rowMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const priceMatch = row.match(/\$\s*([\d.,]+)/);
    if (!priceMatch) continue;
    const price = parseAmount(priceMatch[1]);
    if (price <= 0) continue;
    // Name = everything before the price
    const name = row.slice(0, row.indexOf(priceMatch[0])).replace(/x\s*\d+/i, "").trim();
    if (name.length > 2 && name.length < 120) {
      items.push({ name, price });
    }
  }
  return items;
}

/** Extrae ítems de texto plano con patrón "nombre ... $precio" */
function extractItemsFromText(text: string): InvoiceItem[] {
  const items: InvoiceItem[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const priceMatch = line.match(/\$\s*([\d.,]+)/);
    if (!priceMatch) continue;
    const price = parseAmount(priceMatch[1]);
    if (price <= 0 || price > 500000) continue;
    const name = line.slice(0, line.indexOf(priceMatch[0])).replace(/x\s*\d+/i, "").trim();
    if (name.length > 2 && name.length < 100) {
      items.push({ name, price });
    }
  }
  return items;
}

function buildResult(
  merchant: string,
  amount: number,
  items: InvoiceItem[],
  date: Date,
  description: string,
  accountHint: string | null = null
): ParsedEmail {
  const merchantNormalized = normalize(merchant);
  const category =
    items.length > 0
      ? categorizeByItems(items)
      : merchantToCategory(merchantNormalized);
  return {
    amount: -Math.abs(amount),
    currency: "ARS",
    description,
    merchant,
    merchantNormalized,
    date,
    accountHint,
    category,
    items: items.length > 0 ? items : undefined,
  };
}

// ── PedidosYa ─────────────────────────────────────────────────────────────────
const parsePedidosYa: Parser = ({ from, subject, htmlBody, textBody }) => {
  const isPY =
    from.toLowerCase().includes("pedidosya") ||
    subject.toLowerCase().includes("pedidosya") ||
    subject.toLowerCase().includes("pedidos ya") ||
    subject.toLowerCase().includes("tu pedido");

  if (!isPY) return null;

  const text = textBody || htmlBody?.replace(/<[^>]+>/g, " ") || "";

  // Restaurante / tienda
  const storeMatch =
    text.match(/(?:pedido en|tu pedido de|restaurante|tienda)[:\s]+([^\n\r]+)/i) ||
    text.match(/en\s+([A-ZÁÉÍÓÚ][^\n\r]{2,40})/);
  const merchant = storeMatch ? storeMatch[1].trim() : "PedidosYa";

  // Total
  const totalMatch = text.match(/(?:total|total a pagar|monto total)[:\s]*\$?\s*([\d.,]+)/i);
  if (!totalMatch) return null;
  const amount = parseAmount(totalMatch[1]);
  if (amount <= 0) return null;

  // Ítems
  const items = htmlBody
    ? extractItemsFromHtml(htmlBody)
    : extractItemsFromText(text);

  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  const date = parseArgDate(dateMatch?.[1]) ?? new Date();

  return buildResult(merchant, amount, items, date, `PedidosYa — ${merchant}`);
};

// ── Rappi ─────────────────────────────────────────────────────────────────────
const parseRappi: Parser = ({ from, subject, htmlBody, textBody }) => {
  const isRappi =
    from.toLowerCase().includes("rappi") ||
    subject.toLowerCase().includes("rappi") ||
    /tu pedido|confirmaci[oó]n de pedido/i.test(subject);

  if (!isRappi) return null;

  const text = textBody || htmlBody?.replace(/<[^>]+>/g, " ") || "";

  const storeMatch =
    text.match(/(?:tienda|restaurante|compra en)[:\s]+([^\n\r]+)/i) ||
    text.match(/en\s+([A-ZÁÉÍÓÚ][^\n\r]{2,40})/);
  const merchant = storeMatch ? storeMatch[1].trim() : "Rappi";

  const totalMatch = text.match(/(?:total|total del pedido)[:\s]*\$?\s*([\d.,]+)/i);
  if (!totalMatch) return null;
  const amount = parseAmount(totalMatch[1]);
  if (amount <= 0) return null;

  const items = htmlBody
    ? extractItemsFromHtml(htmlBody)
    : extractItemsFromText(text);

  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  const date = parseArgDate(dateMatch?.[1]) ?? new Date();

  return buildResult(merchant, amount, items, date, `Rappi — ${merchant}`);
};

// ── Mercado Libre ─────────────────────────────────────────────────────────────
const parseMercadoLibre: Parser = ({ from, subject, textBody, htmlBody }) => {
  const isML =
    from.toLowerCase().includes("mercadolibre") ||
    from.toLowerCase().includes("mercado libre") ||
    /tu compra|compraste|acreditaci[oó]n|orden #/i.test(subject);

  if (!isML) return null;

  const text = textBody || htmlBody?.replace(/<[^>]+>/g, " ") || "";

  // Producto
  const productMatch =
    text.match(/(?:tu compra:|compraste)[:\s]+([^\n\r]+)/i) ||
    text.match(/producto[:\s]+([^\n\r]+)/i);
  const productName = productMatch ? productMatch[1].trim() : subject;

  // Monto
  const amountMatch = text.match(/(?:total|precio|pagaste)[:\s]*\$?\s*([\d.,]+)/i) ||
    text.match(/\$\s*([\d.,]+)/);
  if (!amountMatch) return null;
  const amount = parseAmount(amountMatch[1]);
  if (amount <= 0) return null;

  // Cantidad
  const qtyMatch = text.match(/cantidad[:\s]*(\d+)/i);
  const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;

  // Vendedor
  const sellerMatch = text.match(/(?:vendedor|vendido por)[:\s]+([^\n\r]+)/i);
  const seller = sellerMatch ? sellerMatch[1].trim() : null;

  // Número de orden
  const orderMatch = text.match(/(?:orden|pedido)[#\s]*([A-Z0-9-]+)/i);

  // Categoría por keywords del producto
  const category = categorizeMercadoLibreProduct(productName);

  const merchant = seller ?? "Mercado Libre";
  const merchantNormalized = normalize("Mercado Libre");

  return {
    amount: -Math.abs(amount),
    currency: "ARS",
    description: `ML: ${productName}${orderMatch ? ` (#${orderMatch[1]})` : ""}`,
    merchant,
    merchantNormalized,
    date: new Date(),
    accountHint: null,
    category,
    items: [{ name: productName, price: amount / qty }],
  };
};

function categorizeMercadoLibreProduct(name: string): string {
  const lower = name.toLowerCase();
  if (/celular|notebook|laptop|tablet|auricular|smartwatch|teclado|mouse|monitor|tv |televisor|consola|playstation|xbox|nintendo|cámara|camara/.test(lower)) return "Electrónica";
  if (/remera|pantalon|zapato|ropa|vestido|camisa|campera|buzo|jean|calzado|zapatilla/.test(lower)) return "Ropa y calzado";
  if (/silla|mesa|cama|mueble|sof[áa]|estante|lámpara|lampara|colchón|colchon/.test(lower)) return "Hogar y muebles";
  if (/herramienta|taladro|sierra|llave|destornillador|pintura|cemento/.test(lower)) return "Herramientas";
  if (/libro|manual|enciclopedia/.test(lower)) return "Educación";
  if (/juguete|muñeca|pelota|juego de mesa|lego/.test(lower)) return "Juguetes";
  if (/perfume|crema|maquillaje|cosmético|cosmetico/.test(lower)) return "Belleza";
  if (/vitamina|suplemento|proteína|proteina/.test(lower)) return "Salud";
  return "Compras online";
}

// ── Uber ──────────────────────────────────────────────────────────────────────
const parseUber: Parser = ({ from, subject, htmlBody, textBody }) => {
  const isUber =
    from.toLowerCase().includes("uber") ||
    subject.toLowerCase().includes("uber");

  if (!isUber) return null;

  const text = textBody || htmlBody?.replace(/<[^>]+>/g, " ") || "";
  const fullText = `${subject} ${text}`;

  // Detectar si es Uber Eats o viaje normal
  const isEats =
    subject.toLowerCase().includes("eats") ||
    /restaurant|pedido|entrega|delivery|orden/i.test(fullText);

  const amountMatch = fullText.match(/\$\s*([\d.,]+)/);
  if (!amountMatch) return null;
  const amount = parseAmount(amountMatch[1]);
  if (amount <= 0) return null;

  if (isEats) {
    const storeMatch = text.match(/(?:restaurante|tienda|de)[:\s]+([A-ZÁÉÍÓÚ][^\n\r]{2,40})/i);
    const merchant = storeMatch ? storeMatch[1].trim() : "Uber Eats";
    const items = htmlBody ? extractItemsFromHtml(htmlBody) : extractItemsFromText(text);
    return buildResult(merchant, amount, items, new Date(), `Uber Eats — ${merchant}`);
  }

  // Viaje
  const originMatch = text.match(/(?:origen|from|de)[:\s]+([^\n\r]+)/i);
  const destMatch = text.match(/(?:destino|to|hacia|a)[:\s]+([^\n\r]+)/i);
  const tripDesc = originMatch && destMatch
    ? `Uber: ${originMatch[1].trim()} → ${destMatch[1].trim()}`
    : "Uber — Viaje";

  return {
    amount: -Math.abs(amount),
    currency: "ARS",
    description: tripDesc,
    merchant: "Uber",
    merchantNormalized: "Uber",
    date: new Date(),
    accountHint: null,
    category: "Transporte",
    items: undefined,
  };
};

// ── Galicia ───────────────────────────────────────────────────────────────────
const parseGalicia: Parser = ({ from, subject, textBody }) => {
  if (!from.toLowerCase().includes("galicia") && !subject.match(/consumo|débito|debito/i)) return null;

  const text = textBody || "";
  const amountMatch = text.match(/\$\s*([\d.,]+)/);
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[1]);
  const cardMatch = text.match(/terminada\s+en\s+(\d{4})/i);
  const merchantRaw = text.match(/en\s+([A-Z][^\n.]+?)(?:\s+el|\s+por|\.|$)/i)?.[1]?.trim() ?? null;
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);

  const merchantNormalized = merchantRaw ? normalize(merchantRaw) : null;

  return {
    amount: -Math.abs(amount),
    currency: "ARS",
    description: subject,
    merchant: merchantRaw,
    merchantNormalized,
    date: parseArgDate(dateMatch?.[1]) ?? new Date(),
    accountHint: cardMatch ? cardMatch[1] : null,
    category: merchantNormalized ? merchantToCategory(merchantNormalized) : null,
  };
};

// ── Brubank ───────────────────────────────────────────────────────────────────
const parseBrubank: Parser = ({ from, subject, textBody }) => {
  if (!from.toLowerCase().includes("brubank") && !subject.toLowerCase().includes("brubank")) return null;

  const text = textBody || "";
  const rawAmount = subject.match(/\$\s*([\d.,]+)/) ?? text.match(/\$\s*([\d.,]+)/);
  if (!rawAmount) return null;

  const amount = parseAmount(rawAmount[1]);
  const isCredit = /recibiste|recib[ií]/i.test(subject + text);
  const descMatch = text.match(/(?:compra|transferencia|débito|debito)[:\s]+([^\n]+)/i);
  const desc = descMatch ? descMatch[1].trim() : subject;
  const merchantNormalized = normalize(desc);

  return {
    amount: isCredit ? Math.abs(amount) : -Math.abs(amount),
    currency: "ARS",
    description: desc,
    merchant: null,
    merchantNormalized,
    date: new Date(),
    accountHint: null,
    category: merchantToCategory(merchantNormalized),
  };
};

// ── BBVA ──────────────────────────────────────────────────────────────────────
const parseBBVA: Parser = ({ from, subject, textBody }) => {
  if (!from.toLowerCase().includes("bbva") && !subject.toLowerCase().includes("bbva")) return null;

  const text = textBody || "";
  const amountMatch = text.match(/\$\s*([\d.,]+)/);
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[1]);
  const merchantRaw = text.match(/(?:comercio|en)\s*:\s*([^\n]+)/i)?.[1]?.trim() ?? null;
  const cardMatch = text.match(/terminada\s+en\s+(\d{4})/i);
  const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
  const merchantNormalized = merchantRaw ? normalize(merchantRaw) : null;

  return {
    amount: -Math.abs(amount),
    currency: "ARS",
    description: subject,
    merchant: merchantRaw,
    merchantNormalized,
    date: parseArgDate(dateMatch?.[1]) ?? new Date(),
    accountHint: cardMatch ? cardMatch[1] : null,
    category: merchantNormalized ? merchantToCategory(merchantNormalized) : null,
  };
};

// ── Mercado Pago ──────────────────────────────────────────────────────────────
const parseMercadoPago: Parser = ({ from, subject, textBody }) => {
  const isMP =
    from.toLowerCase().includes("mercadopago") ||
    from.toLowerCase().includes("mercadolibre") ||
    /realizaste un pago|recibiste dinero/i.test(subject);

  if (!isMP) return null;

  const text = `${subject} ${textBody || ""}`;
  const amountMatch = text.match(/\$\s*([\d.,]+)/);
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[1]);
  const isCredit = /recibiste/i.test(subject);

  return {
    amount: isCredit ? Math.abs(amount) : -Math.abs(amount),
    currency: "ARS",
    description: subject,
    merchant: null,
    merchantNormalized: "Mercado Pago",
    date: new Date(),
    accountHint: null,
    category: "Transferencias",
  };
};

// ── PayPal ────────────────────────────────────────────────────────────────────
const parsePayPal: Parser = ({ from, subject, textBody }) => {
  if (!from.toLowerCase().includes("paypal") && !subject.toLowerCase().includes("paypal")) return null;

  const isSent = /enviaste|sent/i.test(subject);
  const isReceived = /recibiste|received/i.test(subject);
  if (!isSent && !isReceived) return null;

  const text = `${subject} ${textBody || ""}`;
  const amountMatch = text.match(/(USD|EUR|ARS)\s*([\d.,]+)/i);
  if (!amountMatch) return null;

  const currency = amountMatch[1].toUpperCase();
  const amount = parseFloat(amountMatch[2].replace(/,/g, ""));
  const recipientMatch = text.match(/(?:a|to|para)\s+([A-Za-z][^\n]+?)(?:\s+por|\s+for|\.|$)/i);

  return {
    amount: isSent ? -Math.abs(amount) : Math.abs(amount),
    currency,
    description: subject,
    merchant: recipientMatch ? recipientMatch[1].trim() : null,
    merchantNormalized: "PayPal",
    date: new Date(),
    accountHint: null,
    category: "Transferencias",
  };
};

// ── Wise ──────────────────────────────────────────────────────────────────────
const parseWise: Parser = ({ from, subject, textBody }) => {
  if (!from.toLowerCase().includes("wise") && !from.toLowerCase().includes("transferwise")) return null;

  const text = `${subject} ${textBody || ""}`;
  const amountMatch = text.match(/([\d.,]+)\s+(USD|EUR|GBP|ARS|BRL)/i);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  const currency = amountMatch[2].toUpperCase();
  const isSent = /sent|enviaste|transferiste/i.test(subject);

  return {
    amount: isSent ? -Math.abs(amount) : Math.abs(amount),
    currency,
    description: subject,
    merchant: null,
    merchantNormalized: "Wise",
    date: new Date(),
    accountHint: null,
    category: "Transferencias",
  };
};

// ── Registry & main parse function ────────────────────────────────────────────
// Order matters: more specific parsers go first
const PARSERS: Parser[] = [
  parsePedidosYa,
  parseRappi,
  parseMercadoLibre,
  parseUber,
  parseGalicia,
  parseBrubank,
  parseBBVA,
  parseMercadoPago,
  parsePayPal,
  parseWise,
];

export function parseEmail(email: {
  from: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
}): ParsedEmail | null {
  for (const parser of PARSERS) {
    try {
      const result = parser(email);
      if (result) return result;
    } catch (err) {
      console.error(`[emailParser] Parser failed:`, err);
    }
  }
  return null;
}
