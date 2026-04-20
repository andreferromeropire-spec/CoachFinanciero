import type { Metadata, Viewport } from "next";
import { ClientShell } from "./components/ClientShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coach Financiero IA",
  description: "Tu coach financiero personal con inteligencia artificial",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CoachIA",
  },
  icons: {
    apple: "/icon-192.png",
    icon: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#14B8A6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="CoachIA" />
      </head>
      <body className="bg-base text-hi min-h-screen flex font-sans antialiased">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
