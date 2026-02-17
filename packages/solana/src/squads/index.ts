// Squads Smart Account module — implemented in task S2b
export { deriveSmartAccountPda, deriveSettingsPda, deriveSpendingLimitPda, SQUADS_PROGRAM_ID } from "./accounts.js";
export { createSmartAccountInstruction, addSpendingLimitInstruction, useSpendingLimitInstruction, removeSpendingLimitInstruction } from "./instructions.js";
export { createSpendingLimit, checkSpendingLimit, revokeSpendingLimit } from "./spending.js";
export type { SpendingLimitConfig, SmartAccountConfig } from "./types.js";
