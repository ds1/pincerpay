export const BASE_URL = "https://pincerpay.com";

/**
 * Safely serialize an object to JSON for embedding in a `<script>` tag.
 * Escapes `</` sequences to prevent script tag injection from frontmatter data.
 */
export function safeJsonLd(obj: Record<string, unknown>): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
