import { getAllDocs } from "@/lib/content";
import { SiteHeader } from "@/components/site-header";
import { DocsSidebar } from "./sidebar";
import type { Metadata } from "next";

const BASE_URL = "https://pincerpay.com";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Documentation for PincerPay — the on-chain payment gateway for AI agents. Merchant SDK, Agent SDK, API reference, and integration guides.",
  openGraph: {
    title: "PincerPay Documentation",
    description:
      "Documentation for PincerPay — Merchant SDK, Agent SDK, API reference, and integration guides.",
    url: `${BASE_URL}/docs`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "PincerPay Documentation",
    description:
      "Merchant SDK, Agent SDK, API reference, and integration guides for PincerPay.",
  },
  alternates: {
    canonical: `${BASE_URL}/docs`,
  },
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
