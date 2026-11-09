"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Mail, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/projects` : undefined,
        },
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        setSent(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg text-ink">
      {/* Top Bar */}
      <header className="h-14 border-b border-line bg-surface/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-50">
        <a href="/" className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center font-mono font-bold text-accent-ink text-sm shadow-sm">
            V
          </div>
          <span className="font-semibold text-ink tracking-tight text-base font-mono">
            VoxSpec
          </span>
        </a>
        <ThemeToggle />
      </header>

      {/* Auth Card Container */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md p-8 rounded-lg border border-line bg-surface shadow-sm space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-serif font-bold text-ink">
              Sign in to Studio
            </h1>
            <p className="text-sm text-ink-muted font-sans">
              Enter your email to receive an instant magic link authentication token.
            </p>
          </div>

          {sent ? (
            <div className="p-5 rounded-md border border-ok/30 bg-ok/10 space-y-3">
              <div className="flex items-center gap-2 text-ok font-medium text-sm">
                <CheckCircle2 className="w-4 h-4" /> Magic link dispatched
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                We sent a login link to <strong className="text-ink">{email}</strong>. Check your inbox and follow the link to enter the workspace.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-xs text-accent hover:underline pt-2 block"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-medium text-ink font-mono">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-muted absolute left-3 top-3" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    required
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-line bg-surface-2 text-ink placeholder:text-ink-muted/50 focus:border-focus focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-md border border-danger/30 bg-danger/10 flex items-start gap-2 text-xs text-danger">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-md bg-accent text-accent-ink text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending Link...
                  </>
                ) : (
                  <>
                    Send Magic Link <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-line text-center text-xs text-ink-muted font-mono">
            Protected by Supabase Auth & Row Level Security
          </div>
        </div>
      </main>
    </div>
  );
}
