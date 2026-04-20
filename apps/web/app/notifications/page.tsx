"use client";

import useSWR from "swr";
import { fetcher, apiFetch } from "../../lib/api";
import { formatDate } from "../../lib/format";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: string; style: string }> = {
  BUDGET_WARNING:         { icon: "📊", style: "bg-warning/10 border-warning/20" },
  BUDGET_OVER:            { icon: "⚠️", style: "bg-danger/10 border-danger/20"  },
  UNCATEGORIZED_REMINDER: { icon: "📂", style: "bg-sky/10 border-sky/20"        },
  GENERAL:                { icon: "ℹ️", style: "bg-raised border-border"        },
};

export default function NotificationsPage() {
  const { data, mutate } = useSWR<{ notifications: Notification[]; unreadCount: number }>(
    "/api/notifications",
    fetcher
  );

  async function markAllRead() {
    await apiFetch("/api/notifications/read-all", { method: "POST" });
    mutate();
  }

  async function markRead(id: string) {
    await apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    mutate();
  }

  const notifications = data?.notifications ?? [];

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-[2rem] font-bold text-hi tracking-tight leading-none">Notificaciones</h1>
          {data?.unreadCount ? (
            <p className="text-warning text-sm mt-1.5 font-semibold">{data.unreadCount} sin leer</p>
          ) : (
            <p className="text-mid text-sm mt-1.5 font-medium">Todo al día ✓</p>
          )}
        </div>
        {data?.unreadCount ? (
          <button
            onClick={markAllRead}
            className="text-xs text-mid hover:text-hi border border-border hover:border-mid
                       px-3 py-2 rounded-xl transition-colors bg-white font-medium shadow-sm"
          >
            Marcar todas como leídas
          </button>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <div className="card p-14 text-center">
          <div className="w-16 h-16 rounded-2xl bg-raised border border-border flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <p className="text-hi font-semibold text-sm mb-1">Sin notificaciones</p>
          <p className="text-lo text-xs">Cuando haya alertas de presupuesto aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => {
            const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.GENERAL;
            return (
              <div
                key={n.id}
                className={`border rounded-xl p-4 flex gap-3.5 cursor-pointer transition-all duration-200 ${
                  n.read
                    ? "border-border bg-white opacity-60"
                    : `${config.style} hover:shadow-card-md hover:-translate-y-0.5`
                }`}
                onClick={() => !n.read && markRead(n.id)}
              >
                <span className="text-xl shrink-0 mt-0.5">{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-hi">{n.title}</p>
                  <p className="text-xs text-mid mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-xs text-lo mt-1.5">{formatDate(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <span className="w-2.5 h-2.5 bg-warning rounded-full shrink-0 mt-1.5" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
