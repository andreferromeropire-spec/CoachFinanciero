const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export { API as API_BASE };

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("coach_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Pide un access token nuevo con la cookie de refresh (httpOnly).
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { token?: string };
      if (data.token) {
        localStorage.setItem("coach_token", data.token);
        return data.token;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * Revoca el refresh en el servidor y borra el access en localStorage.
 */
export async function logoutUser(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" });
  } catch {
    /* no bloquea cerrar sesión en el cliente */
  }
  localStorage.removeItem("coach_token");
}

function jsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json" };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const doRequest = () =>
    fetch(`${API}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...jsonHeaders(),
        ...authHeaders(),
        ...(init?.headers ?? {}),
      },
    });

  let res = await doRequest();
  if (res.status === 401) {
    const newTok = await refreshAccessToken();
    if (newTok) {
      res = await doRequest();
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; code?: string };
    const msg = err.error ?? `API ${path} → ${res.status}`;
    const e = new Error(msg) as Error & { status?: number; code?: string };
    e.status = res.status;
    e.code = err.code;
    throw e;
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const fetcher = <T>(url: string): Promise<T> => apiFetch<T>(url);

/**
 * Fetch con Bearer + cookies; en 401 intenta refresh y reintenta una vez. Útil para streams y FormData.
 */
export async function fetchWithAuthRetry(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const isForm = init?.body instanceof FormData;
  const doRequest = () => {
    const h: Record<string, string> = {
      ...authHeaders(),
      ...(init?.headers as Record<string, string> ?? {}),
    };
    if (!isForm && !h["Content-Type"] && !h["content-type"]) {
      h["Content-Type"] = "application/json";
    }
    return fetch(url, { ...init, credentials: "include", headers: h });
  };
  let res = await doRequest();
  if (res.status === 401) {
    if (await refreshAccessToken()) {
      res = await doRequest();
    }
  }
  return res;
}
