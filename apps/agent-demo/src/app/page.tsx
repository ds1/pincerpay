export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      {/* Hero */}
      <section className="mb-20 text-center">
        <div className="mb-4 inline-block rounded-full border border-border px-4 py-1.5 text-xs text-text-muted">
          x402 Protocol &middot; USDC Settlement &middot; Solana
        </div>
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-text">
          Build Agents That{" "}
          <span className="bg-gradient-to-r from-accent to-yellow bg-clip-text text-transparent">
            Pay for APIs
          </span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-text-muted">
          PincerPay lets AI agents autonomously pay for API access using USDC
          micropayments. No card rails, no 3% fees. Instant on-chain
          settlement via the x402 protocol.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a
            href="/playground"
            className="glow inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Open Playground
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          <a
            href="/playground?tour=1"
            className="inline-flex items-center gap-2 rounded-lg border border-border-bright px-6 py-3 font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Guided Demo
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-20">
        <h2 className="mb-8 text-center text-2xl font-semibold text-text">
          How It Works
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: "1",
              title: "Agent Requests",
              desc: "Agent calls a paid API endpoint like any HTTP request",
              color: "text-cyan",
            },
            {
              step: "2",
              title: "402 Challenge",
              desc: "Server responds with HTTP 402 and a payment payload",
              color: "text-yellow",
            },
            {
              step: "3",
              title: "Agent Pays",
              desc: "Agent signs a USDC payment and resubmits the request",
              color: "text-orange",
            },
            {
              step: "4",
              title: "Data Delivered",
              desc: "Facilitator settles payment, merchant delivers the data",
              color: "text-green",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-border bg-bg-card p-5"
            >
              <div className={`mb-2 text-sm font-bold ${item.color}`}>
                Step {item.step}
              </div>
              <div className="mb-1 font-semibold text-text">{item.title}</div>
              <div className="text-sm text-text-muted">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mb-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              title: "Automatic Payments",
              desc: "agent.fetch() handles 402 challenges transparently. Your agent just makes HTTP requests — PincerPay handles the rest.",
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              ),
            },
            {
              title: "Spending Policies",
              desc: "Set per-request limits and daily budgets. Agents enforce spending policies automatically before signing any payment.",
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              ),
            },
            {
              title: "Any Chain",
              desc: "Solana (primary), Base, and Polygon supported. USDC settlement with sub-second latency on Solana.",
              icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 01-1.161.886l-.143.048a1.107 1.107 0 00-.57 1.664c.369.555.169 1.307-.427 1.592L9 13.125l.423 1.059a.956.956 0 01-1.652.928l-.679-.906a1.125 1.125 0 00-1.906.172L4.5 15.75l-.612.153M12.75 3.031a9 9 0 00-8.862 12.872M12.75 3.031a9 9 0 016.69 14.036m0 0l-.177-.529A2.25 2.25 0 0017.128 15H16.5l-.324-.324a1.453 1.453 0 00-2.328.377l-.036.073a1.586 1.586 0 01-.982.816l-.99.282c-.55.157-.894.702-.8 1.267l.073.438c.08.474.49.821.97.821.846 0 1.598.542 1.865 1.345l.215.643m5.276-3.67a9.012 9.012 0 01-5.276 3.67" />
                </svg>
              ),
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-bg-card p-6 transition-colors hover:border-border-bright"
            >
              <div className="mb-3 text-accent">{feature.icon}</div>
              <div className="mb-2 font-semibold text-text">{feature.title}</div>
              <div className="text-sm leading-relaxed text-text-muted">
                {feature.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Code Snippet */}
      <section className="mb-20">
        <h2 className="mb-6 text-center text-2xl font-semibold text-text">
          6 Lines of Code
        </h2>
        <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-border bg-bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <div className="h-3 w-3 rounded-full bg-red/40" />
            <div className="h-3 w-3 rounded-full bg-yellow/40" />
            <div className="h-3 w-3 rounded-full bg-green/40" />
            <span className="ml-2 text-xs text-text-dim">agent.ts</span>
          </div>
          <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed">
            <code>
              <span className="text-accent">import</span>
              {" { PincerPayAgent } "}
              <span className="text-accent">from</span>
              {' "@pincerpay/agent";\n\n'}
              <span className="text-accent">const</span>
              {" agent = "}
              <span className="text-accent">await</span>
              {" PincerPayAgent."}
              <span className="text-yellow">create</span>
              {"({\n"}
              {"  chains: ["}
              <span className="text-green">{'"solana"'}</span>
              {"],\n"}
              {"  solanaPrivateKey: process.env."}
              <span className="text-cyan">AGENT_SOLANA_KEY</span>
              {",\n});\n\n"}
              {""}
              <span className="text-accent">const</span>
              {" response = "}
              <span className="text-accent">await</span>
              {" agent."}
              <span className="text-yellow">fetch</span>
              {"("}
              <span className="text-green">{'"https://api.example.com/weather"'}</span>
              {");\n"}
              <span className="text-accent">const</span>
              {" data = "}
              <span className="text-accent">await</span>
              {" response."}
              <span className="text-yellow">json</span>
              {"();\n"}
            </code>
          </pre>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center">
        <div className="flex items-center justify-center gap-3">
          <a
            href="/playground"
            className="glow inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3.5 text-lg font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Try It Now
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
          <a
            href="/playground?tour=1"
            className="inline-flex items-center gap-2 rounded-lg border border-border-bright px-8 py-3.5 text-lg font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Guided Demo
          </a>
        </div>
      </section>
    </main>
  );
}
