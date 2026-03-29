"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 600 }}>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
        <pre style={{ background: "#f5f5f5", padding: "1rem", borderRadius: 8, fontSize: "0.8rem", overflow: "auto", whiteSpace: "pre-wrap" }}>
          {error.message}
        </pre>
        <button onClick={reset} style={{ marginTop: "1rem", padding: "0.5rem 1rem", cursor: "pointer" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
