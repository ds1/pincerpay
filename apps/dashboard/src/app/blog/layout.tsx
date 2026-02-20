import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";

const BASE_URL = "https://pincerpay.com";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Technical deep dives, product updates, and perspectives on the agentic economy from PincerPay.",
  openGraph: {
    title: "PincerPay Blog",
    description:
      "Technical deep dives, product updates, and perspectives on the agentic economy.",
    url: `${BASE_URL}/blog`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "PincerPay Blog",
    description:
      "Technical deep dives, product updates, and perspectives on the agentic economy.",
  },
  alternates: {
    canonical: `${BASE_URL}/blog`,
  },
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </>
  );
}
