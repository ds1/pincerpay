"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks: { href: string; label: string; external?: boolean }[] = [
  { href: "/docs", label: "Docs" },
  { href: "https://demo.pincerpay.com", label: "Demo", external: true },
  { href: "/blog", label: "Blog" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--background)]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-bold">
            Pincer<span className="text-[var(--primary)]">Pay</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                !link.external && pathname.startsWith(link.href);
              const className = `px-3 py-1.5 rounded-md text-sm transition-colors ${
                isActive
                  ? "text-[var(--foreground)] font-medium"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`;
              return link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={className}
                >
                  {link.label}
                </a>
              ) : (
                <Link key={link.href} href={link.href} className={className}>
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-4 py-1.5 bg-[var(--primary)] text-white text-sm rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
        </div>
        {/* Mobile menu button */}
        <button
          type="button"
          className="sm:hidden p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            )}
          </svg>
        </button>
      </div>
      {/* Mobile nav dropdown */}
      {mobileOpen && (
        <nav className="sm:hidden border-t border-[var(--border)] px-6 py-4 flex flex-col gap-3">
          {navLinks.map((link) => {
            const isActive =
              !link.external && pathname.startsWith(link.href);
            const className = `text-sm transition-colors ${
              isActive
                ? "text-[var(--foreground)] font-medium"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`;
            return link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className={className}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={className}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="flex gap-3 pt-2 border-t border-[var(--border)]">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setMobileOpen(false)}
              className="px-4 py-1.5 bg-[var(--primary)] text-white text-sm rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
