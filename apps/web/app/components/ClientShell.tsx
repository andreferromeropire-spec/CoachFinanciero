"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { ErrorBoundary } from "./ErrorBoundary";

const AUTH_PATHS = ["/login", "/register", "/waitlist-pending", "/forgot-password", "/reset-password", "/auth"];

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuth = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  useEffect(() => {
    const token = localStorage.getItem("coach_token");
    if (!token && !isAuth) {
      router.replace("/login");
    }
  }, [pathname, isAuth, router]);

  /* Un solo hijo en <body> flex row: sin ancho mínimo el bloque se achica al texto y queda a la izquierda */
  if (isAuth) {
    return (
      <ErrorBoundary>
        <div className="w-full flex-1 min-w-0 min-h-screen self-stretch flex flex-col">{children}</div>
        <Toaster position="top-right" richColors />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto min-h-screen pb-16 md:pb-0">
        {children}
      </main>
      <BottomNav />
      <Toaster position="top-right" richColors />
    </ErrorBoundary>
  );
}
