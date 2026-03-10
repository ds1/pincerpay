---
"@pincerpay/merchant": minor
"@pincerpay/agent": minor
"@pincerpay/mcp": minor
"@pincerpay/core": minor
---

Slim launch: lightweight Next.js middleware, remove Express/Hono middleware

- **@pincerpay/merchant**: Replace Express and Hono middleware with `createPincerPayMiddleware` — a lightweight Hono middleware that delegates settlement to the facilitator via fetch(). Zero @x402/*/viem/@solana/kit imports. New sub-path export: `@pincerpay/merchant/nextjs`.
- **@pincerpay/agent**: Remove `SolanaSmartAgent` export (Squads integration). Core `PincerPayAgent` unchanged.
- **@pincerpay/mcp**: Scaffold tool generates Next.js-only code. Prompts updated to remove framework selection.
