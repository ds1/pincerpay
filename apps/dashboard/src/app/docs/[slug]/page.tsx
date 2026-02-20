import { notFound } from "next/navigation";
import { getAllDocs, getDoc } from "@/lib/content";
import { Markdown } from "@/components/markdown";
import Link from "next/link";

export function generateStaticParams() {
  return getAllDocs().map((doc) => ({ slug: doc.meta.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    const doc = getDoc(slug);
    if (!doc) return {};
    return {
      title: `${doc.meta.title} — PincerPay Docs`,
      description: doc.meta.description,
    };
  });
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

  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        {doc.meta.title}
      </h1>
      {doc.meta.description && (
        <p className="text-lg text-[var(--muted-foreground)] mb-8">
          {doc.meta.description}
        </p>
      )}
      <Markdown content={doc.content} />
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
  );
}
