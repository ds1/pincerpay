"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-[var(--muted-foreground)]">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-sm hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}
