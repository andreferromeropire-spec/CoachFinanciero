"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "../../lib/api";

interface NotifData { unreadCount: number }

/* ── SVG icon set ─────────────────────────────────────────────────────────── */
const Icons = {
  Dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  Transactions: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 7h20M6 11l-4 4 4 4M18 11l4 4-4 4" />
    </svg>
  ),
  Coach: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" strokeWidth="2.5" />
    </svg>
  ),
  History: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Bell: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
};

const NAV = [
  { href: "/",             label: "Dashboard",      icon: Icons.Dashboard },
  { href: "/transactions", label: "Transacciones",  icon: Icons.Transactions },
  { href: "/coach",        label: "Coach IA",       icon: Icons.Coach },
  { href: "/history",      label: "Historia",       icon: Icons.History },
  { href: "/settings",     label: "Configuración",  icon: Icons.Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: notifData } = useSWR<NotifData>("/api/notifications", fetcher, { refreshInterval: 30_000 });
  const unread = notifData?.unreadCount ?? 0;

  return (
    <aside className="w-60 bg-white border-r border-border flex flex-col h-screen sticky top-0 shrink-0 shadow-[1px_0_0_0_#E2E8F0]">
      {/* Logo */}
      <div className="px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal to-teal-hover flex items-center justify-center shadow-md">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <p className="text-hi font-bold text-sm leading-none">Coach Financiero</p>
            <p className="text-lo text-[10px] mt-0.5 font-medium">IA Personal Finance</p>
          </div>
        </div>
      </div>

      <div className="mx-4 h-px bg-border mb-3" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 flex flex-col gap-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-teal/10 text-teal shadow-sm"
                  : "text-mid hover:text-hi hover:bg-raised"
              }`}
            >
              <span className={`transition-colors duration-200 ${active ? "text-teal" : "text-lo group-hover:text-mid"}`}>
                {icon}
              </span>
              <span className="flex-1">{label}</span>
              {active && (
                <span className="w-1.5 h-1.5 rounded-full bg-teal" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Notification badge */}
      {unread > 0 && (
        <Link
          href="/notifications"
          className="mx-3 mb-3 flex items-center gap-3 bg-warning/10 border border-warning/20
                     rounded-xl px-4 py-3 hover:bg-warning/15 transition-all duration-200 group"
        >
          <span className="text-warning">{Icons.Bell}</span>
          <span className="text-xs text-warning/90 flex-1 font-medium">
            {unread} alerta{unread > 1 ? "s" : ""}
          </span>
          <span className="bg-warning text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        </Link>
      )}

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <p className="text-[11px] text-lo">v0.4 · Prompt 4</p>
      </div>
    </aside>
  );
}
