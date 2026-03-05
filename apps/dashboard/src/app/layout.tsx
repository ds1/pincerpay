import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import { SupabaseProvider } from "@/lib/supabase/provider";
import { SolanaWalletProvider } from "@/lib/solana/wallet-provider";
import { BASE_URL, safeJsonLd } from "@/lib/constants";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito-sans",
});

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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "PincerPay",
    title: "PincerPay — On-chain payments for AI agents",
    description:
      "Accept USDC payments from AI agents. Add a few lines of code. Settle instantly on Solana via the x402 protocol.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "PincerPay — On-chain payments for AI agents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PincerPay — On-chain payments for AI agents",
    description:
      "Accept USDC payments from AI agents. Add a few lines of code. Settle instantly on Solana via the x402 protocol.",
    creator: "@pincerpay",
    images: ["/og-image.png"],
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
  other: {
    "theme-color": "#F97316",
    "msapplication-TileColor": "#070300",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "PincerPay",
  url: BASE_URL,
  logo: `${BASE_URL}/icon-512.png`,
  description:
    "On-chain payment gateway for AI agents. Accept USDC payments via the x402 protocol with instant settlement on Solana.",
  sameAs: ["https://x.com/pincerpay"],
};

const webSiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PincerPay",
  url: BASE_URL,
  description:
    "Accept USDC payments from AI agents. Settle instantly on Solana via the x402 protocol.",
  publisher: { "@type": "Organization", name: "PincerPay" },
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
  const solanaRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "";
  const solanaNetwork = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as "devnet" | "mainnet-beta";

  return (
    <html lang="en" className={`dark ${nunitoSans.variable}`}>
      <head>
        <link rel="alternate" type="text/plain" href="/llms.txt" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(webSiteSchema) }}
        />
      </head>
      <body className={`min-h-screen antialiased ${nunitoSans.className}`}>
        <SupabaseProvider url={supabaseUrl} publishableKey={supabaseKey}>
          <SolanaWalletProvider rpcUrl={solanaRpcUrl || undefined} network={solanaNetwork}>
            {children}
          </SolanaWalletProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}
