import { notFound } from "next/navigation";
import { getAllBlogPosts, getBlogPost } from "@/lib/content";
import { Markdown } from "@/components/markdown";
import Link from "next/link";

export function generateStaticParams() {
  return getAllBlogPosts().map((post) => ({ slug: post.meta.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return params.then(({ slug }) => {
    const post = getBlogPost(slug);
    if (!post) return {};
    return {
      title: `${post.meta.title} — PincerPay Blog`,
      description: post.meta.description,
    };
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return (
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
        <Markdown content={post.content} />
      </div>
    </article>
  );
}
