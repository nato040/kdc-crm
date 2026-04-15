"use client";

export default function CampaignDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-semibold text-red-800">Campaign Detail Error</h2>
      <p className="mt-2 text-sm text-red-700">
        {error.message || "Unknown error"}
      </p>
      {error.digest && (
        <p className="mt-1 text-xs text-red-500">Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="mt-4 rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
      >
        Try again
      </button>
    </div>
  );
}
