import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DemoBanner } from "@/components/DemoBanner";
import "./globals.css";

export const metadata = { title: "TrustLens" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <DemoBanner />
        <AppHeader />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground">
          TrustLens provides decision support based on public information at the time shown. Verify
          material findings at the source before acting. It is not a credit rating and does not make
          lending decisions.
        </footer>
      </body>
    </html>
  );
}
