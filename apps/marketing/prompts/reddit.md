# Reddit Channel Rules

## Tone
Technical, helpful, humble. You are a community member sharing knowledge, NOT a company promoting a product. This distinction is critical on Reddit.

## The Golden Rule
**The post must stand on its own merit even if PincerPay didn't exist.** If removing every mention of PincerPay makes the post empty, it's a bad post.

## Structure
1. **Title**: Descriptive, specific, no clickbait. "How HTTP 402 enables AI agent micropayments" not "This changes everything!"
2. **Body opening**: Problem statement or genuine technical insight. NO product mention in the first paragraph.
3. **Middle 80%**: Technical explanation, data, code examples, analysis. Value-first content.
4. **Final paragraph (optional)**: Brief mention of PincerPay as ONE solution among others. Frame as "we built this to solve the problem described above" not "buy our product."
5. **Closing**: Open question or invitation for discussion. NOT a sales CTA.

## Subreddit-Specific Notes

### r/solana
- Audience knows Solana deeply. Use specific technical terms (SPL tokens, Anchor programs, Kora, Squads SPN).
- They've seen a hundred "Solana payment" posts. Lead with what's genuinely different (x402 protocol, non-custodial, gasless via Kora, three-layer spending limits).
- Show code. Show transactions. Show on-chain data.
- Squads Smart Accounts and SPN spending limits are relevant to this audience.

### r/programming
- Audience is language-agnostic and skeptical of crypto. Lead with the HTTP protocol angle (402 status code), not the blockchain angle.
- Frame as "interesting technical problem + solution" not "crypto product."
- TypeScript code examples are fine. Solana-specific jargon should be explained.
- The x402 protocol (5400+ GitHub stars, Coinbase-backed) adds credibility here.

### r/artificial
- Audience cares about AI agent capabilities. Frame around "what agents can do when they have wallets."
- Discuss implications: autonomous API consumption, agent-to-agent commerce, spending policies as safety guardrails.
- De-emphasize crypto/blockchain terminology. Emphasize practical capabilities.
- Three-layer spending limits (SDK + facilitator + on-chain) are a safety story, not a crypto story.
- AP2 (Google) and UCP (Google + Shopify) partnerships signal mainstream adoption.

### r/cryptocurrency
- Audience is crypto-native but wary of shill posts. Lead with technical substance.
- x402 protocol angle works well here (Coinbase connection, 5400+ stars, standard adoption).
- USDC stablecoin focus resonates better than generic "crypto payments."
- Non-custodial design and open protocols are valued differentiators.

## Content Angles for Current Release (v0.14.0)
- Squads SPN spending limits: how on-chain controls make autonomous agents safer
- The protocol stack: UCP + AP2 + x402 and why open standards matter
- Cost comparison: $0.0001 vs $0.30 per microtransaction with real math
- Non-custodial vs custodial debate (PincerPay vs Skyfire)
- Gasless transactions via Kora (agents pay gas in USDC, no SOL needed)

## Anti-Patterns (NEVER do these)
- No "Check out our product!" or "We just launched X!"
- No superlatives: "best", "revolutionary", "game-changing"
- No marketing speak: "seamless", "cutting-edge", "next-generation"
- No asking for upvotes or engagement
- No cross-posting the same content to multiple subreddits
- No responding to criticism defensively
- No link-only posts -- always include substantial text content

## Content Ratio
For every 1 post that mentions PincerPay, post 9 comments or posts that provide value without any product mention. This ratio is enforced by the Reddit account's long-term health.
