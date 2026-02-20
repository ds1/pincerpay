"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-3xl font-bold tracking-tight mb-6 mt-10 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-2xl font-semibold tracking-tight mb-4 mt-8 pb-2 border-b border-[var(--border)]">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-xl font-semibold mb-3 mt-6">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-lg font-medium mb-2 mt-4">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="mb-4 leading-7 text-[var(--foreground)]">{children}</p>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-[var(--primary)] hover:underline"
            target={href?.startsWith("http") ? "_blank" : undefined}
            rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="mb-4 ml-6 list-disc space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 ml-6 list-decimal space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-7">{children}</li>,
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-sm font-mono text-[var(--primary)]">
                {children}
              </code>
            );
          }
          return (
            <code className={`${className} text-sm`} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto rounded-lg bg-[#0d0d0d] border border-[var(--border)] p-4 text-sm leading-6">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-4 border-l-4 border-[var(--primary)] pl-4 text-[var(--muted-foreground)] italic">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-[var(--border)]">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="px-4 py-2 text-left font-medium text-[var(--muted-foreground)]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2 border-b border-[var(--border)]">
            {children}
          </td>
        ),
        hr: () => <hr className="my-8 border-[var(--border)]" />,
        img: ({ src, alt }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt ?? ""}
            className="mb-4 rounded-lg max-w-full"
          />
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
