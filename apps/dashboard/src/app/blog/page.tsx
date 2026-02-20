import Link from "next/link";
import { getAllBlogPosts } from "@/lib/content";

export default function BlogIndex() {
  const posts = getAllBlogPosts();

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Blog</h1>
      <p className="text-[var(--muted-foreground)] mb-10">
        Technical deep dives, product updates, and perspectives on the agentic
        economy.
      </p>
      {posts.length === 0 ? (
        <p className="text-[var(--muted-foreground)]">No posts yet.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {posts.map((post) => (
            <article
              key={post.meta.slug}
              className="group rounded-lg border border-[var(--border)] p-6 transition-colors hover:border-[var(--muted-foreground)]"
            >
              <Link href={`/blog/${post.meta.slug}`} className="block">
                <time className="text-xs text-[var(--muted-foreground)]">
                  {new Date(post.meta.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <h2 className="text-xl font-semibold mt-1 mb-2 group-hover:text-[var(--primary)] transition-colors">
                  {post.meta.title}
                </h2>
                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                  {post.meta.description}
                </p>
                {post.meta.tags.length > 0 && (
                  <div className="flex gap-2 mt-3">
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
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
