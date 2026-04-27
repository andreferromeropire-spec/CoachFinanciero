export function formatCurrency(amount: number | string, currency = "ARS"): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

export const formatMoney = formatCurrency;

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(date));
}

export function sourceIcon(source: string): string {
  switch (source) {
    case "EMAIL": return "✉️";
    case "API": return "🔗";
    case "CSV": return "📄";
    case "MANUAL": return "✏️";
    default: return "•";
  }
}

export function sourceLabel(source: string): string {
  switch (source) {
    case "EMAIL": return "Email";
    case "API": return "Webhook";
    case "CSV": return "CSV";
    case "MANUAL": return "Manual";
    default: return source;
  }
}
