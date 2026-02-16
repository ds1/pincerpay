import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-4">
          Pincer<span className="text-[var(--primary)]">Pay</span>
        </h1>
        <p className="text-xl text-[var(--muted-foreground)] mb-8">
          On-chain USDC payments for AI agents.
          <br />
          No card rails. Instant settlement. Every chain.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 bg-[var(--primary)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 border border-[var(--border)] rounded-lg font-medium hover:bg-[var(--muted)] transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </main>
  );
}
