import type { Metadata } from "next";
import { SupabaseProvider } from "@/lib/supabase/provider";
import { BASE_URL } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "PincerPay — On-chain payments for AI agents",
    template: "%s — PincerPay",
  },
  description:
    "Accept USDC payments from AI agents. Add a few lines of code. Settle instantly on Solana via the x402 protocol.",
  keywords: [
    "ai agent payments",
    "x402 protocol",
    "usdc payments",
    "stablecoin api",
    "solana payment gateway",
    "machine to machine payments",
    "http 402",
    "agent commerce",
    "micropayments",
    "on-chain payments",
  ],
  authors: [{ name: "PincerPay", url: BASE_URL }],
  creator: "PincerPay",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "PincerPay",
    title: "PincerPay — On-chain payments for AI agents",
    description:
      "Accept USDC payments from AI agents. Add a few lines of code. Settle instantly on Solana via the x402 protocol.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PincerPay — On-chain payments for AI agents",
    description:
      "Accept USDC payments from AI agents. Add a few lines of code. Settle instantly on Solana via the x402 protocol.",
    creator: "@pincerpay",
  },
  alternates: {
    canonical: BASE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "";

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="alternate" type="text/plain" href="/llms.txt" />
      </head>
      <body className="min-h-screen antialiased">
        <SupabaseProvider url={supabaseUrl} publishableKey={supabaseKey}>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
