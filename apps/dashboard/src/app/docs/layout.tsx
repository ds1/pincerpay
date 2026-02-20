import { getAllDocs } from "@/lib/content";
import { SiteHeader } from "@/components/site-header";
import { DocsSidebar } from "./sidebar";

export const metadata = {
  title: "Docs — PincerPay",
  description:
    "Documentation for PincerPay — the on-chain payment gateway for AI agents.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const docs = getAllDocs();

  const sections: Record<string, { slug: string; title: string }[]> = {};
  for (const doc of docs) {
    const section = doc.meta.section;
    if (!sections[section]) sections[section] = [];
    sections[section].push({ slug: doc.meta.slug, title: doc.meta.title });
  }

  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex max-w-6xl">
        <DocsSidebar sections={sections} />
        <main className="min-w-0 flex-1 px-8 py-10">{children}</main>
      </div>
    </>
  );
}
