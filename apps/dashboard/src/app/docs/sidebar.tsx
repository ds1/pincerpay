"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface DocsSidebarProps {
  sections: Record<string, { slug: string; title: string }[]>;
}

export function DocsSidebar({ sections }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-[var(--border)] py-8 pr-4 lg:block">
      <nav className="flex flex-col gap-6">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section}>
            <h4 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {section}
            </h4>
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => {
                const href = `/docs/${item.slug}`;
                const active = pathname === href;
                return (
                  <li key={item.slug}>
                    <Link
                      href={href}
                      className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)] font-medium"
                          : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]"
                      }`}
                    >
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
