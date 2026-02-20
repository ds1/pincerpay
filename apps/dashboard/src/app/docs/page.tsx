import { redirect } from "next/navigation";
import { getAllDocs } from "@/lib/content";

export default function DocsIndex() {
  const docs = getAllDocs();
  const first = docs[0];
  if (first) {
    redirect(`/docs/${first.meta.slug}`);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Documentation</h1>
      <p className="text-[var(--muted-foreground)]">
        No documentation pages found. Add markdown files to{" "}
        <code className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-sm font-mono">
          content/docs/
        </code>
        .
      </p>
    </div>
  );
}
