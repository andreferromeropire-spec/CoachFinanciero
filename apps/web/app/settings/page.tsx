"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { fetcher, apiFetch } from "../../lib/api";
import { formatCurrency } from "../../lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Account {
  id: string;
  name: string;
  type: string;
  provider: string;
  currency: string;
  balance: string;
  _count?: { transactions: number };
}

interface Settings {
  id: string;
  monthlyIncomeAvg: string | null;
  savingsGoalPercent: number | null;
  maxInstallmentPercent: number | null;
  sonnetCallsThisMonth: number;
  sonnetCallsLimit: number;
  haikusCallsThisMonth: number;
}

const ACCOUNT_TYPES = ["CHECKING", "SAVINGS", "CREDIT", "DIGITAL_WALLET"];
const PROVIDERS = ["MERCADOPAGO", "PAYPAL", "WISE", "BRUBANK", "BBVA", "GALICIA", "MANUAL"];

export default function SettingsPage() {
  const { data: accounts, mutate: mutateAccounts } = useSWR<Account[]>("/api/accounts", fetcher);
  const { data: settings, mutate: mutateSettings } = useSWR<Settings>("/api/settings", fetcher);

  const [newAccount, setNewAccount] = useState({
    name: "", type: "CHECKING", provider: "MANUAL", currency: "ARS", balance: "0",
  });
  const [settingsForm, setSettingsForm] = useState({
    monthlyIncomeAvg: "",
    savingsGoalPercent: "",
    maxInstallmentPercent: "",
    sonnetCallsLimit: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [editBalance, setEditBalance] = useState<Record<string, string>>({});

  // IMAP import state
  const [imapSince, setImapSince] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [imapImporting, setImapImporting] = useState(false);
  const [imapProgress, setImapProgress] = useState<{ processed: number; total: number; percent: number } | null>(null);
  const [imapResult, setImapResult] = useState<{ imported: number; duplicates: number; errors: number; total: number } | null>(null);
  const [imapError, setImapError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  async function handleImapImport() {
    setImapImporting(true);
    setImapProgress(null);
    setImapResult(null);
    setImapError(null);

    try {
      const resp = await fetch(`${API_URL}/api/ingest/imap/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since: imapSince }),
      });

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream available");

      abortRef.current = () => reader.cancel();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              setImapResult(data);
              setImapImporting(false);
            } else if (data.error) {
              setImapError(data.error);
              setImapImporting(false);
            } else if (data.processed !== undefined) {
              setImapProgress(data);
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      setImapError(err instanceof Error ? err.message : String(err));
      setImapImporting(false);
    }
  }

  useEffect(() => () => { abortRef.current?.(); }, []);

  async function handleCreateAccount() {
    setCreatingAccount(true);
    try {
      await apiFetch("/api/accounts", {
        method: "POST",
        body: JSON.stringify(newAccount),
      });
      setNewAccount({ name: "", type: "CHECKING", provider: "MANUAL", currency: "ARS", balance: "0" });
      mutateAccounts();
    } finally {
      setCreatingAccount(false);
    }
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("¿Eliminar esta cuenta?")) return;
    await apiFetch(`/api/accounts/${id}`, { method: "DELETE" });
    mutateAccounts();
  }

  async function handleUpdateBalance(id: string) {
    const balance = editBalance[id];
    if (!balance) return;
    await apiFetch(`/api/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ balance: parseFloat(balance) }),
    });
    setEditBalance((prev) => { const n = { ...prev }; delete n[id]; return n; });
    mutateAccounts();
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      const body: Record<string, number> = {};
      if (settingsForm.monthlyIncomeAvg) body.monthlyIncomeAvg = parseFloat(settingsForm.monthlyIncomeAvg);
      if (settingsForm.savingsGoalPercent) body.savingsGoalPercent = parseFloat(settingsForm.savingsGoalPercent);
      if (settingsForm.maxInstallmentPercent) body.maxInstallmentPercent = parseFloat(settingsForm.maxInstallmentPercent);
      if (settingsForm.sonnetCallsLimit) body.sonnetCallsLimit = parseInt(settingsForm.sonnetCallsLimit, 10);
      await apiFetch("/api/settings", { method: "PATCH", body: JSON.stringify(body) });
      mutateSettings();
      setSettingsForm({ monthlyIncomeAvg: "", savingsGoalPercent: "", maxInstallmentPercent: "", sonnetCallsLimit: "" });
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-[2rem] font-bold text-hi tracking-tight leading-none">Configuración</h1>
        <p className="text-mid text-sm mt-1.5 font-medium">Administrá tus cuentas y parámetros financieros</p>
      </div>

      {/* Accounts */}
      <Section title="Cuentas" icon="🏦">
        <div className="space-y-2 mb-5">
          {accounts?.map((acc) => (
            <div key={acc.id} className="flex items-center gap-3 bg-raised rounded-xl px-4 py-3 border border-border/60">
              <div className="w-9 h-9 rounded-xl bg-white border border-border flex items-center justify-center text-base shadow-sm">
                {acc.provider === "MERCADOPAGO" ? "💙" :
                 acc.provider === "PAYPAL" ? "🔵" :
                 acc.provider === "BBVA" ? "🏦" : "💳"}
              </div>
              <div className="flex-1">
                <span className="text-hi text-sm font-semibold">{acc.name}</span>
                <span className="ml-2 text-xs text-lo">{acc.provider} · {acc.type}</span>
              </div>
              <div className="flex items-center gap-2">
                {editBalance[acc.id] !== undefined ? (
                  <>
                    <input
                      type="number"
                      value={editBalance[acc.id]}
                      onChange={(e) => setEditBalance((p) => ({ ...p, [acc.id]: e.target.value }))}
                      className="input-light w-28 py-1.5"
                    />
                    <button
                      onClick={() => handleUpdateBalance(acc.id)}
                      className="text-xs text-success hover:text-success/80 font-semibold"
                    >
                      Guardar
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-mono font-semibold text-hi">
                      {formatCurrency(parseFloat(acc.balance), acc.currency)}
                    </span>
                    <button
                      onClick={() => setEditBalance((p) => ({ ...p, [acc.id]: acc.balance }))}
                      className="text-xs text-mid hover:text-hi font-medium transition-colors"
                    >
                      Editar
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDeleteAccount(acc.id)}
                  className="text-xs text-danger hover:text-danger/80 font-semibold transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
          {!accounts?.length && (
            <p className="text-lo text-sm text-center py-4">No hay cuentas registradas aún</p>
          )}
        </div>

        <div className="border border-border rounded-xl p-5 bg-raised/40">
          <p className="text-xs font-semibold text-lo uppercase tracking-wider mb-4">Nueva cuenta</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <input
              placeholder="Nombre (ej: Galicia CC)"
              value={newAccount.name}
              onChange={(e) => setNewAccount((p) => ({ ...p, name: e.target.value }))}
              className="input-light"
            />
            <input
              placeholder="Saldo inicial"
              type="number"
              value={newAccount.balance}
              onChange={(e) => setNewAccount((p) => ({ ...p, balance: e.target.value }))}
              className="input-light"
            />
            <select
              value={newAccount.type}
              onChange={(e) => setNewAccount((p) => ({ ...p, type: e.target.value }))}
              className="select-light"
            >
              {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select
              value={newAccount.provider}
              onChange={(e) => setNewAccount((p) => ({ ...p, provider: e.target.value }))}
              className="select-light"
            >
              {PROVIDERS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <button
            disabled={!newAccount.name || creatingAccount}
            onClick={handleCreateAccount}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {creatingAccount ? "Creando..." : "Crear cuenta"}
          </button>
        </div>
      </Section>

      {/* Financial Settings */}
      <Section title="Parámetros financieros" icon="📊">
        <div className="grid grid-cols-2 gap-4 mb-5">
          <SettingField
            label="Ingreso mensual promedio (ARS)"
            placeholder={settings?.monthlyIncomeAvg ? formatCurrency(parseFloat(settings.monthlyIncomeAvg)) : "Ej: 500000"}
            value={settingsForm.monthlyIncomeAvg}
            onChange={(v) => setSettingsForm((p) => ({ ...p, monthlyIncomeAvg: v }))}
          />
          <SettingField
            label="Meta de ahorro (%)"
            placeholder={settings?.savingsGoalPercent != null ? `${settings.savingsGoalPercent}%` : "Ej: 20"}
            value={settingsForm.savingsGoalPercent}
            onChange={(v) => setSettingsForm((p) => ({ ...p, savingsGoalPercent: v }))}
          />
          <SettingField
            label="Máximo cuotas (% ingreso)"
            placeholder={settings?.maxInstallmentPercent != null ? `${settings.maxInstallmentPercent}%` : "Ej: 30"}
            value={settingsForm.maxInstallmentPercent}
            onChange={(v) => setSettingsForm((p) => ({ ...p, maxInstallmentPercent: v }))}
          />
          <SettingField
            label="Límite llamadas Sonnet/mes"
            placeholder={`Actual: ${settings?.sonnetCallsLimit ?? 20}`}
            value={settingsForm.sonnetCallsLimit}
            onChange={(v) => setSettingsForm((p) => ({ ...p, sonnetCallsLimit: v }))}
          />
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={savingSettings}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          {savingSettings ? "Guardando..." : "Guardar configuración"}
        </button>
      </Section>

      {/* IMAP History Import */}
      <Section title="Importar historial completo" icon="📬">
        <p className="text-sm text-mid mb-4">
          Conecta tu casilla de Gmail para importar automáticamente todos los mails de
          PedidosYa, Rappi, Uber, Mercado Libre, bancos y más.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-mid block mb-1">Importar desde</label>
            <input
              type="date"
              value={imapSince}
              onChange={(e) => setImapSince(e.target.value)}
              className="input-light w-full"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleImapImport}
              disabled={imapImporting}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              {imapImporting ? "⏳ Importando..." : "📥 Importar historial"}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {imapImporting && imapProgress && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-mid mb-1.5">
              <span>Procesados: {imapProgress.processed} / {imapProgress.total}</span>
              <span>{imapProgress.percent.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-teal rounded-full transition-all duration-500"
                style={{ width: `${imapProgress.percent}%` }}
              />
            </div>
          </div>
        )}
        {imapImporting && !imapProgress && (
          <div className="flex items-center gap-2 text-sm text-mid">
            <span className="w-4 h-4 border-2 border-teal/30 border-t-teal rounded-full animate-spin" />
            Conectando con el servidor IMAP…
          </div>
        )}

        {/* Result */}
        {imapResult && (
          <div className="rounded-xl bg-success/8 border border-success/20 px-4 py-3 text-sm">
            <p className="font-bold text-success mb-1">✅ Importación completada</p>
            <div className="grid grid-cols-3 gap-3 text-xs text-mid">
              <div><span className="font-bold text-hi">{imapResult.imported}</span> importadas</div>
              <div><span className="font-bold text-hi">{imapResult.duplicates}</span> duplicadas</div>
              <div><span className="font-bold text-hi">{imapResult.errors}</span> con error</div>
            </div>
          </div>
        )}
        {imapError && (
          <div className="rounded-xl bg-danger/8 border border-danger/20 px-4 py-3 text-sm text-danger">
            <p className="font-bold mb-1">⚠️ Error al importar</p>
            <p className="text-xs">{imapError}</p>
            <p className="text-xs text-mid mt-1">Verifica las variables IMAP_HOST, IMAP_USER y IMAP_PASSWORD en el .env del servidor.</p>
          </div>
        )}

        <div className="mt-3 p-3 bg-raised rounded-xl text-xs text-mid border border-border">
          <p className="font-semibold text-hi mb-1">¿Cómo configurar Gmail?</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Activa "Acceso IMAP" en <span className="text-teal">Gmail → Configuración → Reenvío e IMAP</span></li>
            <li>Genera un <strong>App Password</strong> en tu cuenta Google → Seguridad → Contraseñas de apps</li>
            <li>Agrega <code className="bg-border px-1 rounded">IMAP_USER</code> e <code className="bg-border px-1 rounded">IMAP_PASSWORD</code> al .env del servidor</li>
          </ol>
        </div>
      </Section>

      {/* AI Usage */}
      <Section title="Uso de IA este mes" icon="🤖">
        <div className="grid grid-cols-2 gap-4">
          <UsageCard
            title="Claude Sonnet"
            used={settings?.sonnetCallsThisMonth ?? 0}
            limit={settings?.sonnetCallsLimit ?? 20}
            color="purple"
          />
          <UsageCard
            title="Claude Haiku"
            used={settings?.haikusCallsThisMonth ?? 0}
            limit={null}
            color="sky"
          />
        </div>
      </Section>

      {/* Email forwarding instructions */}
      <Section title="Reenvío automático de emails" icon="📧">
        <div className="space-y-4 text-sm text-mid">
          <p>Para importar resúmenes bancarios automáticamente, configura el reenvío de correos electrónicos:</p>

          <div className="bg-raised rounded-xl p-4 space-y-2 border border-border/60">
            <p className="text-hi font-semibold text-sm">Gmail</p>
            <ol className="list-decimal list-inside space-y-1.5 text-mid text-xs">
              <li>Ir a Configuración → Reenvío y POP/IMAP</li>
              <li>Agregar dirección de reenvío: <code className="text-teal bg-teal/10 px-1.5 py-0.5 rounded font-mono">ingest@{"{TU_DOMINIO}"}</code></li>
              <li>Crear un filtro: De = <code className="text-teal bg-teal/10 px-1.5 py-0.5 rounded font-mono">alertas@galicia.com.ar OR notificaciones@brubank.com</code></li>
              <li>Acción: Reenviar a la dirección del paso 2</li>
            </ol>
          </div>

          <div className="bg-raised rounded-xl p-4 space-y-2 border border-border/60">
            <p className="text-hi font-semibold text-sm">Envío directo vía API</p>
            <pre className="text-xs text-teal bg-teal/5 border border-teal/15 p-3 rounded-xl overflow-x-auto font-mono">
{`POST ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/ingest/email
Content-Type: application/json

{
  "from": "alertas@galicia.com.ar",
  "subject": "Consumo con tu tarjeta",
  "textBody": "..."
}`}
            </pre>
          </div>

          <p className="text-lo text-xs">Remitentes soportados: Galicia, Brubank, BBVA, Mercado Pago, PayPal, Wise</p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 mb-5">
      <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-border">
        {icon && <span className="text-xl">{icon}</span>}
        <h2 className="font-bold text-hi text-base">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function SettingField({
  label, placeholder, value, onChange,
}: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-mid uppercase tracking-wide">{label}</label>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-light"
      />
    </div>
  );
}

function UsageCard({
  title, used, limit, color,
}: { title: string; used: number; limit: number | null; color: "purple" | "sky" }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : null;
  const barColor = color === "purple" ? "bg-purple" : "bg-sky";
  const bgColor = color === "purple" ? "bg-purple/10 border-purple/15" : "bg-sky/10 border-sky/15";

  return (
    <div className={`rounded-xl p-4 border ${bgColor}`}>
      <p className="text-sm text-mid font-semibold mb-1">{title}</p>
      <p className={`text-3xl font-bold mb-1 ${color === "purple" ? "text-purple" : "text-sky"}`}>{used}</p>
      {limit !== null ? (
        <>
          <p className="text-xs text-lo mb-2">{used} / {limit} llamadas</p>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-lo">Sin límite</p>
      )}
    </div>
  );
}
