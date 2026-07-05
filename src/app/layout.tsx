import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ledger Nine — Autonomous Investment Research",
  description:
    "Evidence-driven multi-agent investment analysis with deterministic INVEST/PASS scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-black text-neutral-100">
        <header className="border-b border-neutral-900 px-4 py-3 flex items-center justify-between shrink-0">
          <Link
            href="/"
            className="font-mono font-bold text-sm text-neutral-100 hover:text-white tracking-wider focus:outline-none focus:underline"
          >
            LEDGER NINE
          </Link>
          <nav aria-label="Primary navigation">
            <Link
              href="/research/new"
              className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors focus:outline-none focus:underline"
            >
              New Research
            </Link>
          </nav>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-neutral-900 px-4 py-3 text-xs text-neutral-700 shrink-0">
          Ledger Nine — Investment decisions are deterministic. Research is advisory only.
        </footer>
      </body>
    </html>
  );
}
