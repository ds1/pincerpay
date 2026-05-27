---
"@pincerpay/core": minor
"@pincerpay/agent": patch
---

Remove orphaned `SolanaSmartAgent` references.

`SolanaSmartAgent` and its implementation were removed from the agent SDK during the slim launch, but the documentation and a dangling type were left behind. `@pincerpay/core` drops the now-dead `SolanaSmartAgentConfig` type export, and the `@pincerpay/agent` README no longer documents the removed class, its methods, or its config. The documented surface now matches what actually ships (`PincerPayAgent`).
