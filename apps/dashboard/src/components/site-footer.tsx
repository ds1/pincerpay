import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
          <div>
            <p className="text-lg font-bold">
              Pincer<span className="text-[var(--primary)]">Pay</span>
            </p>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              On-chain payments for the agentic economy.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-8">
            <div>
              <p className="text-sm font-medium mb-2">Product</p>
              <nav className="flex flex-col gap-1.5">
                <Link href="/docs" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                  Docs
                </Link>
                <a href="https://demo.pincerpay.com" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                  Demo
                </a>
                <Link href="/blog" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                  Blog
                </Link>
              </nav>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Developers</p>
              <nav className="flex flex-col gap-1.5">
                <a href="https://github.com/ds1/pincerpay" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                  GitHub
                </a>
                <a href="https://www.npmjs.com/org/pincerpay" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                  npm
                </a>
              </nav>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Legal</p>
              <nav className="flex flex-col gap-1.5">
                <Link href="/privacy" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                  Terms of Service
                </Link>
              </nav>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Community</p>
              <nav className="flex flex-col gap-1.5">
                <a href="https://discord.gg/sZkYQTqT23" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                  Discord
                </a>
                <a href="https://x.com/pincerpay" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                  @pincerpay on X
                </a>
                <a href="mailto:contact@pincerpay.com" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                  contact@pincerpay.com
                </a>
              </nav>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-[var(--border)] text-sm text-[var(--muted-foreground)]">
          &copy; {new Date().getFullYear()} PincerPay. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
