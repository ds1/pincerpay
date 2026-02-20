import { notFound } from "next/navigation";
import { getAllDocs, getDoc } from "@/lib/content";
import { BASE_URL, safeJsonLd } from "@/lib/constants";
import { Markdown } from "@/components/markdown";
import Link from "next/link";
import type { Metadata } from "next";

export function generateStaticParams() {
  return getAllDocs().map((doc) => ({ slug: doc.meta.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return {};

  const url = `${BASE_URL}/docs/${slug}`;

  return {
    title: doc.meta.title,
    description: doc.meta.description,
    openGraph: {
      title: `${doc.meta.title} — PincerPay Docs`,
      description: doc.meta.description,
      url,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: `${doc.meta.title} — PincerPay Docs`,
      description: doc.meta.description,
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  const allDocs = getAllDocs();
  const idx = allDocs.findIndex((d) => d.meta.slug === slug);
  const prev = idx > 0 ? allDocs[idx - 1] : null;
  const next = idx < allDocs.length - 1 ? allDocs[idx + 1] : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: doc.meta.title,
    description: doc.meta.description,
    url: `${BASE_URL}/docs/${slug}`,
    publisher: {
      "@type": "Organization",
      name: "PincerPay",
      url: BASE_URL,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "PincerPay Documentation",
      url: `${BASE_URL}/docs`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <article className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {doc.meta.title}
        </h1>
        {doc.meta.description && (
          <p className="text-lg text-[var(--muted-foreground)] mb-8">
            {doc.meta.description}
          </p>
        )}
        <Markdown html={doc.html} />
        <nav className="mt-12 flex items-center justify-between border-t border-[var(--border)] pt-6">
          {prev ? (
            <Link
              href={`/docs/${prev.meta.slug}`}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              &larr; {prev.meta.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/docs/${next.meta.slug}`}
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              {next.meta.title} &rarr;
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
    </>
  );
}
