/**
 * financialRules.ts — Reglas financieras personales configurables.
 *
 * Edita estos valores según tu situación. Todas las reglas basadas en
 * porcentajes se aplican sobre el ingreso mensual promedio configurado
 * en Configuración → Parámetros financieros.
 */

export const RULES = {
  // ── Cuotas e deuda ─────────────────────────────────────────────────────────
  /** Máximo % del ingreso mensual que puede ir a cuotas/deuda combinadas */
  maxInstallmentPercent: 30,

  /** Cuotas a evaluar siempre en el análisis de compra */
  installmentOptions: [3, 6, 12, 18, 24],

  // ── Ahorro ─────────────────────────────────────────────────────────────────
  /** Meta de ahorro: % del ingreso mensual a reservar */
  savingsTargetPercent: 20,

  /** Meses de gastos que deberías tener como fondo de emergencia */
  emergencyFundMonths: 3,

  // ── Impacto de compra directa ───────────────────────────────────────────────
  /** Si la compra supera este % del saldo disponible → impacto ALTO */
  highImpactThreshold: 0.30,
  /** Si la compra supera este % del saldo disponible → impacto MEDIO */
  mediumImpactThreshold: 0.10,

  // ── Categorías recortables ──────────────────────────────────────────────────
  /**
   * Categorías de gasto donde se puede recortar para ahorrar.
   * Ordenadas de "más fácil de recortar" a "menos fácil".
   * El análisis sugiere reducirlas un 20% para calcular meses para la meta.
   */
  cuttableCategories: [
    "Entretenimiento",
    "Restaurantes",
    "Compras",
    "Suscripciones",
    "Viajes",
    "Combustible",
  ],

  /**
   * Categorías esenciales: nunca se sugiere recortarlas.
   */
  essentialCategories: [
    "Salud",
    "Educación",
    "Servicios",
    "Transferencias",
    "Finanzas",
  ],

  // ── Texto del asistente ─────────────────────────────────────────────────────
  /**
   * Cuántos meses hacia adelante se considera "razonable" ahorrar para algo.
   * Si tardarías más, el veredicto es "muy caro por ahora".
   */
  maxReasonableSavingMonths: 12,
};

export type FinancialRules = typeof RULES;
