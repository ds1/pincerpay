import { CHAINS } from "@pincerpay/core";
import { getAllDocs } from "@/lib/content";
import { DocSections } from "./doc-sections";

const chainEntries = Object.entries(CHAINS);

/** Maps markdown doc slugs to in-app section config, in display order. */
const docSections = [
  { slug: "getting-started", id: "quickstart", title: "Getting Started" },
  { slug: "merchant-sdk", id: "merchant-sdk", title: "Merchant SDK" },
  { slug: "agent-sdk", id: "agent-sdk", title: "Agent SDK" },
  { slug: null, id: "chains", title: "Supported Chains" },
  { slug: "testing", id: "testnet", title: "Testnet Guide" },
  { slug: "api-reference", id: "api", title: "API Reference" },
  { slug: "faq", id: "faq", title: "FAQ" },
] as const;

function ChainsTable() {
  return (
    <>
      <p>PincerPay supports the following chains for USDC settlement:</p>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="pb-2 pr-4 font-semibold text-[var(--foreground)]">
                Shorthand
              </th>
              <th className="pb-2 pr-4 font-semibold text-[var(--foreground)]">
                Name
              </th>
              <th className="pb-2 pr-4 font-semibold text-[var(--foreground)]">
                USDC Address
              </th>
              <th className="pb-2 font-semibold text-[var(--foreground)]">
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            {chainEntries.map(([shorthand, chain]) => (
              <tr
                key={shorthand}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="py-2 pr-4 font-mono">{shorthand}</td>
                <td className="py-2 pr-4">{chain.name}</td>
                <td className="py-2 pr-4 font-mono truncate max-w-[200px]">
                  {chain.usdcAddress}
                </td>
                <td className="py-2">
                  {chain.testnet ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs">
                      testnet
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs">
                      mainnet
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function DocsPage() {
  const allDocs = getAllDocs();
  const docsBySlug = new Map(allDocs.map((d) => [d.meta.slug, d]));

  const sections = docSections.map((cfg) => {
    if (cfg.slug === null) {
      return { id: cfg.id, title: cfg.title, content: <ChainsTable /> };
    }

    const doc = docsBySlug.get(cfg.slug);
    return {
      id: cfg.id,
      title: cfg.title,
      content: doc ? (
        <div
          className="prose-pincerpay"
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      ) : (
        <p>Documentation not found.</p>
      ),
    };
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Documentation</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Everything you need to integrate PincerPay into your application.
      </p>
      <DocSections sections={sections} />
    </div>
  );
}
