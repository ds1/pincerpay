import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Blog — PincerPay",
  description:
    "Technical deep dives, product updates, and perspectives on the agentic economy.",
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
