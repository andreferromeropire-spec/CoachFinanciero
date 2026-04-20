const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("coach_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// Typed fetcher for SWR — cast to unknown lets SWR infer the generic from useSWR<T>
export const fetcher = <T>(url: string): Promise<T> => apiFetch<T>(url);
