import { SiteHeader } from "@/components/site-header";
import { BASE_URL } from "@/lib/constants";
import type { Metadata } from "next";

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
    images: [{ url: `${BASE_URL}/opengraph-image`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PincerPay Blog",
    description:
      "Technical deep dives, product updates, and perspectives on the agentic economy.",
    images: [`${BASE_URL}/twitter-image`],
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
