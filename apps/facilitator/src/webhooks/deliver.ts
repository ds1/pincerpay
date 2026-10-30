import http from "node:http";
import https from "node:https";
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import { checkWebhookUrl, isNonPublicIp } from "@pincerpay/core";

/**
 * SSRF-safe webhook delivery. Merchant webhook URLs are checked against the
 * shared policy, and the connection's DNS lookup refuses non-public
 * addresses, so a public hostname that resolves (or rebinds) to an internal
 * IP is blocked at connect time. Redirects are never followed.
 */

let allowPrivate = false;

/** Allow http and private/internal destinations. Local development only. */
export function setWebhookAllowPrivate(value: boolean): void {
  allowPrivate = value;
}

/** Reason the URL is not an allowed webhook destination, or null. */
export function webhookUrlProblem(url: string): string | null {
  return checkWebhookUrl(url, { allowPrivate });
}

/** Delivery failure with a merchant-safe reason (no internal addresses or error text). */
export class WebhookDeliveryError extends Error {
  constructor(
    readonly publicReason: "blocked_destination" | "timeout" | "connection_failed",
    detail: string,
  ) {
    super(detail);
  }
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

function publicOnlyLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, []);
    const blocked = addresses.find((a) => isNonPublicIp(a.address));
    if (blocked) {
      const error: NodeJS.ErrnoException = new Error(`${hostname} resolves to non-public address ${blocked.address}`);
      error.code = "EBLOCKED";
      return callback(error, []);
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

/** POST a webhook body. Resolves with the HTTP status code. */
export function postWebhook(
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<number> {
  const problem = webhookUrlProblem(url);
  if (problem) return Promise.reject(new WebhookDeliveryError("blocked_destination", problem));

  const target = new URL(url);
  const transport = target.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      target,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
        lookup: allowPrivate ? undefined : (publicOnlyLookup as never),
        timeout: timeoutMs,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    const timer = setTimeout(() => req.destroy(new WebhookDeliveryError("timeout", `no response within ${timeoutMs}ms`)), timeoutMs);
    req.on("close", () => clearTimeout(timer));
    req.on("timeout", () => req.destroy(new WebhookDeliveryError("timeout", `socket idle for ${timeoutMs}ms`)));
    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err instanceof WebhookDeliveryError) return reject(err);
      const reason = err.code === "EBLOCKED" ? "blocked_destination" : "connection_failed";
      reject(new WebhookDeliveryError(reason, err.message));
    });
    req.end(body);
  });
}
