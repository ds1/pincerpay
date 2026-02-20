import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import { SupabaseProvider } from "@/lib/supabase/provider";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito-sans",
});

export const metadata: Metadata = {
  title: "PincerPay Dashboard",
  description: "Merchant dashboard for PincerPay — on-chain USDC payments for AI agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  return (
    <html lang="en" className={`dark ${nunitoSans.variable}`}>
      <body className={`min-h-screen antialiased ${nunitoSans.className}`}>
        <SupabaseProvider url={supabaseUrl} publishableKey={supabaseKey}>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
