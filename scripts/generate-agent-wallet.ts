import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const key = generatePrivateKey();
const account = privateKeyToAccount(key);
console.log(`AGENT_PRIVATE_KEY=${key}`);
console.log(`AGENT_ADDRESS=${account.address}`);
