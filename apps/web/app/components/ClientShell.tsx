"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

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
    return <div className="w-full flex-1 min-w-0 min-h-screen self-stretch flex flex-col">{children}</div>;
  }

  return (
    <>
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-auto min-h-screen pb-16 md:pb-0">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
