import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center p-8">
        <div className="max-w-2xl text-center">
          <div className="flex justify-center mb-6">
            <Image src="/logo.png" alt="PincerPay" width={80} height={80} />
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Pincer<span className="text-[var(--primary)]">Pay</span>
          </h1>
          <p className="text-lg text-[var(--muted-foreground)] mb-2">
            The payment gateway for the agentic economy.
          </p>
          <p className="text-xl text-[var(--muted-foreground)] mb-8">
            Accept payments from AI agents.
            <br />
            Add a few lines of code. Settle instantly in USDC.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/signup"
              className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
            <Link
              href="/docs"
              className="px-6 py-3 border border-[var(--border)] rounded-lg font-medium hover:bg-[var(--muted)] transition-colors"
            >
              Read the Docs
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
