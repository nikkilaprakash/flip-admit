import "@fontsource-variable/public-sans";
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: { default: "FlipAdmit", template: "%s | FlipAdmit" }, description: "Universities compete for students with scholarships. Students choose." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0E6B66" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
