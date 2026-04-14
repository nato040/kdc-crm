"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-xs font-semibold uppercase tracking-[0.25em] text-charcoal">
            KDC CRM OS
          </h1>
          <p className="mt-2 text-sm text-taupe-dark">
            Kenny Donna Collective
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <p className="text-sm font-medium text-charcoal">
              Check your email for a magic link
            </p>
            <p className="mt-2 text-xs text-taupe-dark">
              We sent a sign-in link to{" "}
              <span className="font-medium text-charcoal">{email}</span>
            </p>
            <button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="mt-4 text-xs text-taupe-dark underline hover:text-charcoal"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-taupe-dark"
              >
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@kennydonna.com"
                required
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending\u2026" : "Send magic link"}
            </Button>
          </form>
        )}

        <p className="mt-8 text-center text-[11px] text-taupe">
          Private system &mdash; authorized personnel only
        </p>
      </div>
    </div>
  );
}
