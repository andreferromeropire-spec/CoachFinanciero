// Mapa de variantes (lowercase) → nombre canónico
const ALIASES: [string[], string][] = [
  [["pedidosya", "pedidos ya", "pedidos-ya", "pya", "pedidosya*"], "PedidosYa"],
  [["rappi", "rappi*", "rappi market", "rappimarket", "rappi turbo"], "Rappi"],
  [["uber eats", "ubereats", "uber eats*", "uber*eats"], "Uber Eats"],
  [["uber", "uber*", "uber cab", "uber viaje"], "Uber"],
  [["mercado libre", "mercadolibre", "ml ", "meli", "meli*", "mercado-libre"], "Mercado Libre"],
  [["mercado pago", "mercadopago", "mp ", "mp*"], "Mercado Pago"],
  [["mc donalds", "mcdonalds", "mcdonald's", "mc donald's", "mcdonals"], "McDonald's"],
  [["burger king", "burgerking", "bk "], "Burger King"],
  [["starbucks", "starbuck's"], "Starbucks"],
  [["kfc", "kentucky fried", "kentucky"], "KFC"],
  [["netflix", "netflix*"], "Netflix"],
  [["spotify", "spotify*"], "Spotify"],
  [["amazon", "amazon*", "amazon prime"], "Amazon"],
  [["apple", "apple.com", "apple itunes", "itunes"], "Apple"],
  [["google", "google*", "google play", "google one"], "Google"],
  [["microsoft", "microsoft*", "xbox"], "Microsoft"],
  [["paypal", "paypal*"], "PayPal"],
  [["wise", "transferwise"], "Wise"],
  [["airbnb", "air bnb"], "Airbnb"],
  [["booking", "booking.com"], "Booking.com"],
  [["farmacity", "farmaci*"], "Farmacity"],
  [["carrefour", "carrefour*"], "Carrefour"],
  [["jumbo", "jumbo*"], "Jumbo"],
  [["coto", "coto*"], "Coto"],
  [["dia", "dia%", "tienda dia"], "Supermercado Día"],
  [["ypf", "ypf*"], "YPF"],
  [["shell", "shell*"], "Shell"],
  [["axion", "axion*"], "Axion"],
  [["cabify", "cabify*"], "Cabify"],
  [["glovo", "glovo*"], "Glovo"],
];

// Índice invertido para lookup O(1)
const exactIndex = new Map<string, string>();
const prefixRules: [string, string][] = [];

for (const [variants, canonical] of ALIASES) {
  for (const v of variants) {
    const key = v.toLowerCase().replace(/\*$/, "").trim();
    if (v.endsWith("*")) {
      prefixRules.push([key, canonical]);
    } else {
      exactIndex.set(key, canonical);
    }
  }
}

/**
 * Normaliza el nombre de un merchant a su forma canónica.
 * 1. Match exacto (case-insensitive)
 * 2. Match por prefijo (para variantes tipo "UBER*")
 * 3. Match por substring en el haystack
 * 4. Limpieza básica: quita códigos de terminal, números solos, asteriscos
 */
export function normalize(rawName: string): string {
  if (!rawName?.trim()) return "Sin especificar";

  const lower = rawName.toLowerCase().trim();

  // 1. Exact match
  const exact = exactIndex.get(lower);
  if (exact) return exact;

  // 2. Prefix match (variantes con *)
  for (const [prefix, canonical] of prefixRules) {
    if (lower.startsWith(prefix)) return canonical;
  }

  // 3. Substring match — recorre los aliases buscando si el rawName los contiene
  for (const [variants, canonical] of ALIASES) {
    for (const v of variants) {
      const key = v.replace(/\*$/, "").toLowerCase().trim();
      if (key.length >= 3 && lower.includes(key)) return canonical;
    }
  }

  // 4. Limpieza básica del string original
  return cleanMerchantName(rawName);
}

function cleanMerchantName(raw: string): string {
  return raw
    .replace(/\*/g, "")                          // quitar asteriscos
    .replace(/\b\d{4,}\b/g, "")                  // quitar códigos numéricos largos
    .replace(/\s{2,}/g, " ")                     // colapsar espacios
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Detecta la categoría probable basándose en el nombre del merchant normalizado.
 * Complementa CategoryMapper cuando no hay descripción de transacción.
 */
export function merchantToCategory(normalized: string): string | null {
  const lower = normalized.toLowerCase();
  if (["pedidosya", "rappi", "uber eats", "glovo"].some((m) => lower.includes(m))) return "Comida y delivery";
  if (["uber", "cabify"].some((m) => lower.includes(m))) return "Transporte";
  if (["netflix", "spotify", "amazon", "apple", "google", "microsoft", "disney"].some((m) => lower.includes(m))) return "Suscripciones";
  if (["farmacity"].some((m) => lower.includes(m))) return "Salud";
  if (["carrefour", "jumbo", "coto", "día"].some((m) => lower.includes(m))) return "Supermercado";
  if (["mercado libre"].some((m) => lower.includes(m))) return "Compras online";
  if (["ypf", "shell", "axion"].some((m) => lower.includes(m))) return "Combustible";
  if (["airbnb", "booking"].some((m) => lower.includes(m))) return "Viajes";
  return null;
}
