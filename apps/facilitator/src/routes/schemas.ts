import { z } from "zod";

export const paymentRequestSchema = z.object({
  paymentPayload: z.record(z.unknown()),
  paymentRequirements: z.object({
    scheme: z.string(),
    network: z.string(),
    amount: z.union([z.string(), z.number()]),
    payTo: z.string(),
  }).passthrough(),
}).passthrough();
