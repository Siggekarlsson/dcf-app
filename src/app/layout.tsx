import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Värdering — DCF med AI",
  description: "Motiverat värde för börsbolag med en DCF-modell du styr med naturligt språk.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
