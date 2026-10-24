import Link from "next/link";
import { AlertBell } from "@/components/AlertBell";

export function AppHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-teal-700">
          TrustLens
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:underline">
            Check
          </Link>
          <Link href="/watchlist" className="hover:underline">
            Watchlist
          </Link>
          <AlertBell />
        </nav>
      </div>
    </header>
  );
}
