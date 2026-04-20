interface Rule {
  keywords: string[];
  category: string;
}

const RULES: Rule[] = [
  {
    keywords: [
      "carrefour", "dia", "coto", "walmart", "jumbo", "disco", "vea",
      "la anonima", "maxiconsumo", "changomas", "super", "supermercado",
      "hipermercado", "mercado", "almacen", "verduleria", "finochietto",
    ],
    category: "Supermercado",
  },
  {
    keywords: [
      "ypf", "shell", "axion", "petrobras", "gulf", "puma energy",
      "nafta", "combustible", "estacion de servicio", "service station",
    ],
    category: "Combustible",
  },
  {
    keywords: [
      "mc donalds", "mcdonalds", "burger king", "subway", "pizza hut",
      "dominos", "kentucky", "kfc", "rappi", "pedidosya", "pedidos ya",
      "glovo", "restaurant", "resto", "cafeteria", "cafe", "starbucks",
      "pizza", "sushi", "delivery", "hamburguesa", "parrilla", "bar ",
    ],
    category: "Restaurantes",
  },
  {
    keywords: [
      "netflix", "spotify", "amazon prime", "disney", "hbo", "apple",
      "microsoft", "adobe", "github", "openai", "chatgpt", "youtube premium",
      "twitch", "steam", "playstation", "xbox", "nintendo",
      "suscripcion", "subscription", "plan mensual",
    ],
    category: "Suscripciones",
  },
  {
    keywords: [
      "farmacia", "farmacity", "doctor", "medico", "clinica", "hospital",
      "laboratorio", "obra social", "osde", "swiss medical", "galeno",
      "salud", "dentista", "optica",
    ],
    category: "Salud",
  },
  {
    keywords: [
      "uber", "cabify", "taxi", "remis", "sube", "metrobus", "subte",
      "tren", "omnibus", "colectivo", "bus ", "transporte",
      "autopista", "peaje", "via bariloche",
    ],
    category: "Transporte",
  },
  {
    keywords: [
      "edesur", "edenor", "aysa", "metrogas", "telecom", "personal",
      "claro", "movistar", "fibertel", "arnet", "expensas", "alquiler",
      "luz", "gas ", "agua ", "internet", "telefonia",
    ],
    category: "Servicios",
  },
  {
    keywords: [
      "zara", "h&m", "adidas", "nike", "falabella", "frávega", "garbarino",
      "musimundo", "easy", "sodimac", "ikea", "ropa", "zapateria",
      "indumentaria", "shopping", "tienda", "mercadolibre", "tiendamia",
    ],
    category: "Compras",
  },
  {
    keywords: [
      "cine", "cinemark", "hoyts", "teatro", "recital", "evento",
      "ticketek", "passline", "shows", "entretenimiento",
    ],
    category: "Entretenimiento",
  },
  {
    keywords: [
      "banco", "transferencia", "transfer", "deposito", "depositar",
      "acreditacion", "credito", "debin", "cvbu", "cbu", "alias",
      "mercadopago", "paypal", "wise", "brubank",
    ],
    category: "Transferencias",
  },
  {
    keywords: [
      "cuota", "prestamo", "hipoteca", "tarjeta", "financiacion",
      "interes", "credito personal", "plan z",
    ],
    category: "Finanzas",
  },
  {
    keywords: [
      "hotel", "airbnb", "booking", "vuelo", "aerolineas", "lan", "latam",
      "viaje", "turismo", "hostel", "hospedaje",
    ],
    category: "Viajes",
  },
  {
    keywords: [
      "colegio", "universidad", "curso", "academia", "udemy", "coursera",
      "libro", "libreria", "educacion",
    ],
    category: "Educación",
  },
];

export function mapCategory(merchant: string | null, description: string | null): string {
  const haystack = `${merchant || ""} ${description || ""}`.toLowerCase();

  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (haystack.includes(keyword)) return rule.category;
    }
  }

  return "Sin categorizar";
}

// ── Categorización por ítems de factura ───────────────────────────────────────

const FOOD_KEYWORDS = [
  "pizza", "burger", "hamburguesa", "sushi", "empanada", "bebida", "gaseosa",
  "agua", "cerveza", "vino", "postre", "helado", "milanesa", "bife", "pollo",
  "ensalada", "sandwich", "wrap", "taco", "pancho", "faina", "facturas",
  "medialunas", "cafe", "jugo", "smoothie", "papas fritas", "nuggets",
  "combo", "menu", "plato", "soda",
];

const CLEANING_KEYWORDS = [
  "jabon", "jabón", "detergente", "shampoo", "champú", "papel", "limpiador",
  "desodorante", "crema", "cepillo", "esponja", "trapo", "lavandina",
  "suavizante", "blanqueador", "lysol", "mr músculo", "mr musculo",
  "desengrasante", "limpia", "lustra", "cera ", "escoba", "bolsa basura",
];

const PHARMACY_KEYWORDS = [
  "ibuprofeno", "paracetamol", "vitamina", "pastilla", "medicamento",
  "aspirina", "omeprazol", "loratadina", "amoxicilina", "antibiotico",
  "antibiótico", "analgesico", "analgésico", "antiinflamatorio",
  "termómetro", "termometro", "curitas", "venda", "alcohol ",
  "barbijo", "guantes", "protector solar", "repelente",
];

export interface InvoiceItem {
  name: string;
  price: number;
}

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

/**
 * Categoriza una orden completa según los ítems individuales.
 * Reglas:
 * - Farmacia: cualquier ítem farmacéutico → "Salud"
 * - >60% ítems de limpieza → "Hogar y limpieza"
 * - >60% ítems de comida → "Comida y delivery"
 * - Mix → usa la categoría del ítem más caro
 * - Sin match → "Sin categorizar"
 */
export function categorizeByItems(items: InvoiceItem[]): string {
  if (!items || items.length === 0) return "Sin categorizar";

  // Prioridad absoluta: farmacia
  if (items.some((i) => matchesAny(i.name, PHARMACY_KEYWORDS))) return "Salud";

  let foodCount = 0;
  let cleaningCount = 0;

  for (const item of items) {
    if (matchesAny(item.name, FOOD_KEYWORDS)) foodCount++;
    else if (matchesAny(item.name, CLEANING_KEYWORDS)) cleaningCount++;
  }

  const total = items.length;
  if (cleaningCount / total > 0.6) return "Hogar y limpieza";
  if (foodCount / total > 0.6) return "Comida y delivery";

  // Mix → categoría del ítem más caro
  const priciest = items.reduce((a, b) => (b.price > a.price ? b : a));
  if (matchesAny(priciest.name, FOOD_KEYWORDS)) return "Comida y delivery";
  if (matchesAny(priciest.name, CLEANING_KEYWORDS)) return "Hogar y limpieza";

  return "Sin categorizar";
}
