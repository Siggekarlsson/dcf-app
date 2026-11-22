import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/opsz.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Valeur — vad är bolaget värt?", template: "%s — Valeur" },
  description: "Valeur värderar svenska börsbolag med en DCF-modell som du justerar själv.",
  applicationName: "Valeur",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f3f0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
