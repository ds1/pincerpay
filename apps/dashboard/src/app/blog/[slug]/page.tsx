import { notFound } from "next/navigation";
import { getAllBlogPosts, getBlogPost } from "@/lib/content";
import { BASE_URL, safeJsonLd } from "@/lib/constants";
import { Markdown } from "@/components/markdown";
import Link from "next/link";
import type { Metadata } from "next";

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.meta.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  const url = `${BASE_URL}/blog/${slug}`;

  return {
    title: post.meta.title,
    description: post.meta.description,
    openGraph: {
      title: `${post.meta.title} — PincerPay Blog`,
      description: post.meta.description,
      url,
      type: "article",
      publishedTime: post.meta.date,
      authors: [post.meta.author],
      tags: post.meta.tags,
      images: [{ url: `${BASE_URL}/opengraph-image`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.meta.title} — PincerPay Blog`,
      description: post.meta.description,
      images: [`${BASE_URL}/twitter-image`],
    },
    alternates: {
      canonical: url,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.meta.title,
    description: post.meta.description,
    datePublished: post.meta.date,
    author: {
      "@type": "Organization",
      name: post.meta.author,
      url: BASE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "PincerPay",
      url: BASE_URL,
    },
    url: `${BASE_URL}/blog/${slug}`,
    keywords: post.meta.tags.join(", "),
    isPartOf: {
      "@type": "Blog",
      name: "PincerPay Blog",
      url: `${BASE_URL}/blog`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <article>
        <Link
          href="/blog"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-6 inline-block"
        >
          &larr; Back to blog
        </Link>
        <time className="block text-sm text-[var(--muted-foreground)] mb-1">
          {new Date(post.meta.date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {post.meta.title}
        </h1>
        <p className="text-[var(--muted-foreground)] mb-1">
          By {post.meta.author}
        </p>
        {post.meta.tags.length > 0 && (
          <div className="flex gap-2 mb-8">
            {post.meta.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-8">
          <Markdown html={post.html} />
        </div>
      </article>
    </>
  );
}
