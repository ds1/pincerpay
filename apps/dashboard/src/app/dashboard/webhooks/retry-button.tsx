"use client";

import { useState } from "react";
import { retryWebhook } from "./actions";

export function RetryButton({ deliveryId }: { deliveryId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleRetry() {
    setLoading(true);
    await retryWebhook(deliveryId);
    setLoading(false);
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="text-xs px-2 py-0.5 rounded bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50"
    >
      {loading ? "..." : "Retry"}
    </button>
  );
}
