import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "PincerPay terms of service — the agreement governing use of our payment facilitation platform.",
};

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-10">Last updated: March 5, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-[var(--muted-foreground)] [&_h2]:text-[var(--foreground)] [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-10 [&_h2]:mb-3 [&_strong]:text-[var(--foreground)] [&_a]:text-[var(--primary)] [&_a]:underline">
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your use of the PincerPay platform, website, APIs, and
            related services (&quot;Service&quot;) operated by PincerPay (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
            By accessing or using the Service, you agree to be bound by these Terms.
          </p>

          <h2>1. Service Description</h2>
          <p>
            PincerPay is an on-chain payment facilitation platform that enables merchants to accept stablecoin
            payments (primarily USDC) from AI agents and other clients via the x402 protocol. We provide payment
            verification, transaction broadcasting, merchant dashboards, and developer SDKs.
          </p>

          <h2>2. Eligibility</h2>
          <p>
            You must be at least 18 years old and have the legal capacity to enter into these Terms. By using the
            Service, you represent that you are not located in, or a resident of, any jurisdiction where the use of
            cryptocurrency payment services is prohibited. You are responsible for compliance with all applicable
            local laws and regulations.
          </p>

          <h2>3. Account Registration</h2>
          <p>
            To use certain features of the Service, you must create an account. You are responsible for maintaining
            the confidentiality of your account credentials, API keys, and wallet private keys. You agree to notify
            us immediately of any unauthorized access to your account.
          </p>

          <h2>4. Payment Facilitation</h2>
          <p>
            PincerPay acts as a payment facilitator, not a custodian. We verify payment transactions and broadcast
            them to blockchain networks on behalf of merchants. We do not hold, custody, or control user funds at
            any time. Payments settle directly between payer wallets and merchant wallets on-chain.
          </p>
          <p>
            <strong>Finality:</strong> Once a transaction is confirmed on the blockchain, it is irreversible.
            PincerPay cannot reverse, cancel, or refund on-chain transactions. Merchants and payers are responsible
            for resolving disputes directly.
          </p>

          <h2>5. Fees</h2>
          <p>
            PincerPay charges a facilitation fee on processed transactions as described in our pricing documentation.
            Blockchain network fees (gas) are paid by the transacting parties, not by PincerPay. We reserve the
            right to modify our fee structure with reasonable notice.
          </p>

          <h2>6. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Violate any applicable laws or regulations</li>
            <li>Process payments for illegal goods or services</li>
            <li>Engage in money laundering, terrorist financing, or sanctions evasion</li>
            <li>Interfere with or disrupt the Service or its infrastructure</li>
            <li>Attempt to gain unauthorized access to other users&apos; accounts or data</li>
            <li>Circumvent any security measures or rate limits</li>
            <li>Use the Service for any fraudulent or deceptive purpose</li>
          </ul>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms without prior notice.
          </p>

          <h2>7. Intellectual Property</h2>
          <p>
            The PincerPay name, logo, website, and proprietary software are owned by PincerPay. Our open-source SDKs
            are licensed under their respective licenses. You retain ownership of your content and data submitted
            through the Service.
          </p>

          <h2>8. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
            EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
            WE DO NOT GUARANTEE THE PERFORMANCE, RELIABILITY, OR AVAILABILITY OF ANY BLOCKCHAIN NETWORK.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, PINCERPAY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
            SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR DIGITAL ASSETS,
            ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY YOU TO
            PINCERPAY IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
          </p>

          <h2>10. Blockchain Risks</h2>
          <p>
            You acknowledge the inherent risks of blockchain technology, including but not limited to: network
            congestion, transaction delays, smart contract vulnerabilities, token price volatility, regulatory
            changes, and protocol upgrades. PincerPay is not responsible for losses arising from these risks.
          </p>

          <h2>11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless PincerPay from any claims, damages, or expenses arising from
            your use of the Service, your violation of these Terms, or your violation of any third-party rights.
          </p>

          <h2>12. Modifications</h2>
          <p>
            We may update these Terms from time to time. Material changes will be communicated by posting the
            updated Terms on this page with a revised &quot;Last updated&quot; date. Continued use of the Service
            after changes constitutes acceptance of the modified Terms.
          </p>

          <h2>13. Termination</h2>
          <p>
            Either party may terminate the relationship at any time. You may close your account by contacting us.
            We may suspend or terminate your access if you violate these Terms. Upon termination, your right to
            use the Service ceases, but provisions that by their nature should survive (including limitations of
            liability and indemnification) will remain in effect.
          </p>

          <h2>14. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with applicable law, without regard to
            conflict of law principles.
          </p>

          <h2>15. Contact Us</h2>
          <p>
            If you have questions about these Terms, contact us at{" "}
            <a href="mailto:contact@pincerpay.com">contact@pincerpay.com</a>.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
