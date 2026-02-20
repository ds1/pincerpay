import "highlight.js/styles/github-dark-dimmed.css";

/**
 * Server component that renders pre-compiled HTML from markdown.
 * Markdown is compiled to HTML at build time in lib/content.ts using
 * unified + remark + rehype, so no client-side JS is needed.
 */
export function Markdown({ html }: { html: string }) {
  return (
    <div
      className="prose-pincerpay"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
