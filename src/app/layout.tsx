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
        <header className="bg-surface border-b-2 border-foreground px-6 py-4 flex items-center justify-between shrink-0 no-print">
          <Link
            href="/"
            className="font-sans font-black text-xl text-foreground tracking-tight uppercase hover:opacity-85 focus:outline-none"
          >
            Ledger Nine
          </Link>
          <nav aria-label="Primary navigation" className="flex items-center gap-6">
            <Link
              href="/#how-it-works"
              className="text-xs font-bold uppercase tracking-wider text-foreground-secondary hover:text-foreground transition-colors focus:outline-none focus:underline"
            >
              Methodology
            </Link>
            <Link
              href="/#search-section"
              className="text-xs font-bold uppercase tracking-wider px-4 py-2 border border-foreground bg-foreground text-white hover:bg-neutral-800 transition-colors shadow-[2px_2px_0px_0px_#737373] focus:outline-none"
            >
              Analyze Company
            </Link>
          </nav>
        </header>

        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="bg-surface border-t border-foreground px-6 py-6 text-2xs uppercase tracking-widest font-mono text-foreground-muted shrink-0 text-center no-print">
          © {new Date().getFullYear()} Ledger Nine. All investment decisions are deterministic. Research analysis is for educational purposes only.
        </footer>
      </body>
    </html>
  );
}
