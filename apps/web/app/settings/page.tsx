"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher, apiFetch, fetchWithAuthRetry, logoutUser } from "../../lib/api";
import { formatCurrency } from "../../lib/format";
import { OnboardingWizard } from "../components/onboarding/OnboardingWizard";

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
  onboardingCompleted: boolean;
  gmailConnected: boolean;
}

const ACCOUNT_TYPES = ["CHECKING", "SAVINGS", "CREDIT", "DIGITAL_WALLET"];
const PROVIDERS = ["MERCADOPAGO", "PAYPAL", "WISE", "BRUBANK", "BBVA", "GALICIA", "MANUAL"];

interface Me {
  id: string;
  email: string;
  isAdmin: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: accounts, mutate: mutateAccounts } = useSWR<Account[]>("/api/accounts", fetcher);
  const { data: settings, mutate: mutateSettings } = useSWR<Settings>("/api/settings", fetcher);
  const { data: me } = useSWR<Me>("/api/auth/me", fetcher);

  const [newAccount, setNewAccount] = useState({
    name: "", type: "CHECKING", provider: "MANUAL", currency: "ARS", balance: "0",
  });
  const [settingsForm, setSettingsForm] = useState({
    monthlyIncomeAvg: "",
    savingsGoalPercent: "",
    maxInstallmentPercent: "",
    sonnetCallsLimit: "",
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [editBalance, setEditBalance] = useState<Record<string, string>>({});

  const abortRef = useRef<(() => void) | null>(null);

  // Gmail connected accounts
  interface ConnectedEmail { id: string; email: string; lastImportAt: string | null; createdAt: string; }
  const { data: connectedEmails, mutate: mutateEmails } = useSWR<ConnectedEmail[]>("/api/emails", fetcher);
  const [importingSince, setImportingSince] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().slice(0, 10);
  });
  const [gmailMaxEmails, setGmailMaxEmails] = useState(3000);
  const [importingId, setImportingId]   = useState<string | null>(null);
  const [importLog, setImportLog]       = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<Record<string, { imported: number; duplicates: number; errors: number }>>({});
  const [gmailToast, setGmailToast]     = useState<string | null>(null);
  const [deleteEmail, setDeleteEmail]     = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const gmailErrMsg: Record<string, string> = {
      cancelado: "Conexión cancelada en Google.",
      token: "Google no aceptó el intercambio de token. Revisá Client ID, Secret y las dos redirect URIs en Google Cloud y en Railway.",
      sin_email: "Google no devolvió el email de la cuenta.",
      error: "Error al guardar la cuenta. Probá de nuevo.",
      oauth_no_configurado: "En Railway faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en el servicio API.",
      falta_redirect_uri:
        "En Railway, GOOGLE_REDIRECT_URI debe ser la del login (termina en /api/auth/google/callback). En Google Console agregá también la de Gmail (/api/auth/google/gmail/callback). Opcional: variable GOOGLE_GMAIL_REDIRECT_URI con esa segunda URL.",
    };
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("gmail_connected");
    const err       = params.get("gmail_error");
    if (connected) {
      setGmailToast(`✅ ${decodeURIComponent(connected)} conectado`);
      mutateEmails();
      window.history.replaceState({}, "", "/settings");
    } else if (err) {
      setGmailToast(`⚠️ ${gmailErrMsg[err] ?? `Error: ${err}`}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, [mutateEmails]);

  async function handleDeleteMyUserAccount() {
    if (!me?.email) {
      setDeleteError("No se pudo cargar tu email. Recargá la página.");
      return;
    }
    if (me.isAdmin) {
      setDeleteError("La cuenta de administrador no se puede eliminar desde acá.");
      return;
    }
    const m = deleteEmail.trim().toLowerCase();
    if (m !== me.email.toLowerCase()) {
      setDeleteError("El email no coincide con el de tu cuenta");
      return;
    }
    if (!confirm("¿Seguro? Se van a borrar transacciones, presupuestos, coach y toda la cuenta. No se puede deshacer.")) {
      return;
    }
    setDeleteError(null);
    setDeleteLoading(true);
    try {
      await apiFetch("/api/auth/delete-account", {
        method: "POST",
        body: JSON.stringify({ emailConfirm: deleteEmail.trim() }),
      });
      await logoutUser();
      router.replace("/login");
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleConnectGmail() {
    const token = typeof window !== "undefined" ? localStorage.getItem("coach_token") ?? "" : "";
    window.location.href = `${API_URL}/api/auth/google/gmail?token=${encodeURIComponent(token)}`;
  }

  async function handleDisconnect(id: string) {
    if (!confirm("¿Desconectar esta cuenta de Gmail?")) return;
    await apiFetch(`/api/emails/${id}`, { method: "DELETE" });
    mutateEmails();
  }

  async function handleGmailImport(accountId: string) {
    setImportingId(accountId);
    setImportLog(prev => ({ ...prev, [accountId]: "Iniciando importación…" }));
    setImportResult(prev => { const n = { ...prev }; delete n[accountId]; return n; });

    try {
      const resp = await fetchWithAuthRetry(`/api/emails/${accountId}/import`, {
        method: "POST",
        body: JSON.stringify({ since: importingSince, maxEmails: gmailMaxEmails }),
      });
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No stream");
      abortRef.current = () => reader.cancel();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress") {
              setImportLog(prev => ({ ...prev, [accountId]: data.message }));
            } else if (data.type === "done") {
              setImportResult(prev => ({ ...prev, [accountId]: data }));
              mutateEmails();
            } else if (data.type === "error") {
              setImportLog(prev => ({ ...prev, [accountId]: `⚠️ ${data.message}` }));
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setImportLog(prev => ({ ...prev, [accountId]: `Error: ${String(e)}` }));
    } finally {
      setImportingId(null);
    }
  }

  // IMAP legacy — kept for backward compat
  const [imapImporting, setImapImporting] = useState(false);
  const [imapResult, setImapResult] = useState<{ imported: number; duplicates: number; errors: number; total: number } | null>(null);
  const [imapError, setImapError] = useState<string | null>(null);
  const [imapProgress, setImapProgress] = useState<{
    processed: number;
    total: number;
    percent: number;
    currentSubject?: string;
  } | null>(null);

  async function handleImapImport() {
    setImapImporting(true);
    setImapResult(null);
    setImapError(null);
    setImapProgress(null);

    try {
      const resp = await fetchWithAuthRetry("/api/ingest/imap/history", {
        method: "POST",
        body: JSON.stringify({ since: importingSince }),
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
              setImapProgress(null);
              setImapImporting(false);
            } else if (data.error) {
              setImapError(data.error);
              setImapProgress(null);
              setImapImporting(false);
            } else if (data.processed !== undefined) {
              setImapProgress({
                processed: data.processed,
                total: data.total,
                percent: data.percent,
                currentSubject: data.currentSubject,
              });
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
      {showOnboarding && (
        <OnboardingWizard onClose={() => { setShowOnboarding(false); mutateSettings(); }} />
      )}

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-bold text-hi tracking-tight leading-none">Configuración</h1>
          <p className="text-mid text-sm mt-1.5 font-medium">Administrá tus cuentas y parámetros financieros</p>
        </div>
        <button
          onClick={() => setShowOnboarding(true)}
          className="shrink-0 flex items-center gap-2 border border-teal/30 bg-teal/8 text-teal hover:bg-teal/15 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Configurar mi cuenta
        </button>
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

      {/* Gmail Connected Accounts */}
      <Section title="Cuentas de Gmail conectadas" icon="📬">
        {gmailToast && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium border ${gmailToast.startsWith("✅") ? "bg-success/8 border-success/20 text-success" : "bg-danger/8 border-danger/20 text-danger"}`}>
            {gmailToast}
          </div>
        )}

        <p className="text-sm text-mid mb-4">
          Conectá una o más casillas de Gmail para importar automáticamente emails de bancos,
          MercadoPago, PayPal, Rappi, Uber, y más. Coach Financiero solo lee tus emails para detectar transacciones.
        </p>

        {/* Lista de cuentas conectadas */}
        {(connectedEmails ?? []).length > 0 && (
          <div className="flex flex-col gap-3 mb-4">
            {(connectedEmails ?? []).map(account => (
              <div key={account.id} className="border border-border rounded-xl p-4 bg-raised">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"/>
                        <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83Z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-hi">{account.email}</p>
                      <p className="text-xs text-lo">
                        {account.lastImportAt
                          ? `Última importación: ${new Date(account.lastImportAt).toLocaleDateString("es-AR")}`
                          : "Sin importaciones aún"}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDisconnect(account.id)} className="text-xs text-lo hover:text-danger transition-colors">
                    Desconectar
                  </button>
                </div>

                {/* Import controls */}
                <p className="text-xs text-mid mb-2">
                  Importá desde una fecha (solo mails de bancos / pagos que ya filtramos). Hasta 5000 mensajes por corrida.
                  <span className="block mt-1.5 text-lo">
                    <strong className="text-mid">Ya importado</strong> = ese mail ya tiene movimiento en la app.
                    Si antes importaste <strong className="text-mid">sin</strong> tener una cuenta creada, al importar de nuevo el sistema intenta completar esos mails desde lo guardado (no hace falta borrar nada).
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(
                    [
                      { label: "2 años", kind: "yearsAgo" as const, years: 2 },
                      { label: "5 años", kind: "yearsAgo" as const, years: 5 },
                      { label: "10 años", kind: "yearsAgo" as const, years: 10 },
                      { label: "Desde 2010", kind: "fixedDate" as const, date: "2010-01-01" },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        if (p.kind === "fixedDate") {
                          setImportingSince(p.date);
                          return;
                        }
                        const d = new Date();
                        d.setFullYear(d.getFullYear() - p.years);
                        setImportingSince(d.toISOString().slice(0, 10));
                      }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-border text-mid hover:border-teal hover:text-teal hover:bg-teal/5 transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <input
                    type="date" value={importingSince}
                    onChange={e => setImportingSince(e.target.value)}
                    className="input-light text-sm flex-1 min-w-0"
                  />
                  <select
                    value={gmailMaxEmails}
                    onChange={(e) => setGmailMaxEmails(Number(e.target.value))}
                    className="input-light text-sm sm:w-44 shrink-0"
                    title="Máximo de mails a listar y procesar en esta corrida"
                  >
                    <option value={500}>Hasta 500 mails</option>
                    <option value={1500}>Hasta 1500 mails</option>
                    <option value={3000}>Hasta 3000 mails</option>
                    <option value={5000}>Hasta 5000 mails</option>
                  </select>
                  <button
                    onClick={() => handleGmailImport(account.id)}
                    disabled={importingId === account.id}
                    className="btn-primary text-sm px-4 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none whitespace-nowrap shrink-0"
                  >
                    {importingId === account.id ? "⏳ Importando…" : "📥 Importar"}
                  </button>
                </div>

                {importLog[account.id] && (
                  <p className="text-xs text-mid mt-2 flex items-center gap-1.5">
                    {importingId === account.id && <span className="w-3 h-3 border-2 border-teal/30 border-t-teal rounded-full animate-spin inline-block" />}
                    {importLog[account.id]}
                  </p>
                )}
                {importResult[account.id] && (
                  <div className="mt-2 p-3 bg-success/8 border border-success/20 rounded-lg text-xs">
                    <span className="font-bold text-success">✅ Listo — </span>
                    <span className="text-mid">{importResult[account.id].imported} importadas · {importResult[account.id].duplicates} duplicadas · {importResult[account.id].errors} sin parsear</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Botón conectar nueva cuenta */}
        <button onClick={handleConnectGmail} className="w-full flex items-center justify-center gap-2.5 px-4 py-3 border-2 border-dashed border-border rounded-xl text-sm font-medium text-mid hover:border-teal hover:text-teal hover:bg-teal/5 transition-all">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"/>
            <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83Z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"/>
          </svg>
          + Conectar cuenta de Gmail
        </button>

        <p className="text-xs text-lo mt-3">
          Solo se leen emails de remitentes bancarios y de pagos. No se accede a emails personales.
        </p>
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

      <Section title="Cuenta" icon="🗑️">
        {me?.isAdmin ? (
          <p className="text-mid text-sm">La cuenta de administración no se puede eliminar desde la app.</p>
        ) : (
          <>
            <p className="text-mid text-sm mb-4">
              Al eliminar, se borran en el servidor tu usuario, transacciones, presupuestos, coach y ajustes. Escribí tu
              <strong> email</strong> exacto y confirmá.
            </p>
            <div className="max-w-md space-y-3">
              <input
                type="email"
                className="input-light w-full"
                placeholder={me?.email ? `Ej: ${me.email}` : "tu@email.com"}
                value={deleteEmail}
                onChange={(e) => { setDeleteEmail(e.target.value); setDeleteError(null); }}
                autoComplete="off"
                disabled={deleteLoading}
              />
              {deleteError && <p className="text-rose-600 text-sm">{deleteError}</p>}
              <button
                type="button"
                onClick={handleDeleteMyUserAccount}
                disabled={deleteLoading}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 disabled:opacity-50"
              >
                {deleteLoading ? "Eliminando…" : "Eliminar mi cuenta definitivamente"}
              </button>
            </div>
          </>
        )}
      </Section>

      {process.env.NEXT_PUBLIC_PAGES_BUILD_SHA ? (
        <p className="text-lo text-[10px] mt-8 text-center font-mono tracking-tight" title="Debe coincidir con el commit del último deploy en Cloudflare Pages">
          Deploy front: {process.env.NEXT_PUBLIC_PAGES_BUILD_SHA.slice(0, 7)}
        </p>
      ) : null}
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
