import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "PincerPay privacy policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-10">Last updated: March 5, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-[var(--muted-foreground)] [&_h2]:text-[var(--foreground)] [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3 [&_strong]:text-[var(--foreground)] [&_a]:text-[var(--primary)] [&_a]:underline">
          <p>
            PincerPay (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the pincerpay.com website and the PincerPay
            payment facilitation service. This Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our services.
          </p>

          <h2>1. Information We Collect</h2>
          <p>
            <strong>Account Information:</strong> When you create a merchant account, we collect your email address,
            organization name, and payment wallet address(es).
          </p>
          <p>
            <strong>Transaction Data:</strong> We process and store transaction records including wallet addresses,
            payment amounts, token types, chain identifiers, and transaction signatures. All payment transactions
            occur on public blockchains and are inherently transparent.
          </p>
          <p>
            <strong>Usage Data:</strong> We automatically collect standard server logs including IP addresses,
            browser type, pages visited, and timestamps to maintain and improve our services.
          </p>
          <p>
            <strong>API Keys:</strong> We generate and store hashed API keys for merchant authentication. We do not
            store private keys for your wallets.
          </p>

          <h2>2. How We Use Your Information</h2>
          <p>We use collected information to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide and maintain the PincerPay payment facilitation service</li>
            <li>Process and verify payment transactions</li>
            <li>Authenticate merchant API requests</li>
            <li>Display transaction history and analytics in your dashboard</li>
            <li>Communicate service updates and security notices</li>
            <li>Detect and prevent fraud or abuse</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2>3. Blockchain Data</h2>
          <p>
            PincerPay facilitates payments on public blockchains (Solana, Base, Polygon). Transaction data submitted
            to these networks is publicly visible, immutable, and outside our control. We cannot delete or modify
            on-chain transaction records.
          </p>

          <h2>4. Third-Party Services</h2>
          <p>We use the following third-party services to operate PincerPay:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Supabase:</strong> Authentication and database hosting</li>
            <li><strong>Vercel:</strong> Website and dashboard hosting</li>
            <li><strong>Railway:</strong> Facilitator service hosting</li>
          </ul>
          <p>
            These providers may process data on our behalf under their own privacy policies. We do not sell your
            personal information to third parties.
          </p>

          <h2>5. Data Retention</h2>
          <p>
            We retain account and transaction data for as long as your account is active or as needed to provide
            our services. You may request deletion of your account data by contacting us. On-chain transaction records
            cannot be deleted as they are part of public blockchain ledgers.
          </p>

          <h2>6. Security</h2>
          <p>
            We implement industry-standard security measures including encrypted connections (TLS), hashed API keys,
            row-level security on database tables, and secure authentication flows. However, no method of electronic
            transmission or storage is 100% secure.
          </p>

          <h2>7. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account data</li>
            <li>Object to or restrict processing of your data</li>
            <li>Data portability</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:contact@pincerpay.com">contact@pincerpay.com</a>.
          </p>

          <h2>8. Cookies</h2>
          <p>
            We use essential cookies for authentication and session management. We do not use third-party tracking
            or advertising cookies.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material changes by posting
            the updated policy on this page with a revised &quot;Last updated&quot; date.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, contact us at{" "}
            <a href="mailto:contact@pincerpay.com">contact@pincerpay.com</a>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
