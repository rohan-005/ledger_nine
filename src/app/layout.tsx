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
    "Evidence-driven investment analysis with deterministic scoring. Calm, professional, and research-focused.",
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="bg-surface border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <Link
            href="/"
            className="font-sans font-extrabold text-lg text-foreground hover:text-primary tracking-tight focus:outline-none focus:underline"
          >
            Ledger Nine
          </Link>
          <nav aria-label="Primary navigation" className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-foreground-secondary hover:text-foreground transition-colors focus:outline-none focus:underline"
            >
              How it works
            </Link>
            <Link
              href="/research/new"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Research a Company
            </Link>
          </nav>
        </header>

        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="bg-surface border-t border-border px-6 py-4 text-xs text-foreground-muted shrink-0 text-center">
          © {new Date().getFullYear()} Ledger Nine. All investment decisions are deterministic. Research analysis is for educational purposes only.
        </footer>
      </body>
    </html>
  );
}
