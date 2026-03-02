import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import Image from "next/image";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito-sans",
});

export const metadata: Metadata = {
  title: "PincerPay Agent Demo",
  description:
    "Interactive demo showing how AI agents pay for APIs using the x402 protocol and PincerPay",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${nunitoSans.variable}`}>
      <body className={`min-h-screen antialiased ${nunitoSans.className}`}>
        <header className="border-b border-border px-6 py-4">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <a href="/" className="flex items-center gap-2.5">
              <Image src="/pincerpay_logo.png" alt="PincerPay" width={32} height={32} />
              <span className="text-lg font-semibold text-text">
                PincerPay <span className="font-normal text-text-muted">Agent Demo</span>
              </span>
            </a>
            <nav className="flex items-center gap-4">
              <a
                href="/playground"
                className="text-sm text-text-muted transition-colors hover:text-text"
              >
                Playground
              </a>
              <a
                href="https://github.com/pincerpay/pincerpay"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-muted transition-colors hover:text-text"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
