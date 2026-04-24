"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const PUBLIC_PATHS = ["/login", "/register", "/waitlist-pending", "/forgot-password", "/reset-password", "/auth"];

export function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("coach_token");
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

    if (!token && !isPublic) {
      router.replace("/login");
    }
  }, [pathname, router]);
}
