"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message || "Invalid login credentials. Please check both and try again.");
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("Unable to authenticate session. Please try again.");
        setLoading(false);
        return;
      }

      // Check user role strictly from the profiles table in Supabase
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      const role = profile?.role || "client";

      // Redirect to target or respective portal
      if (next) {
        router.push(next);
      } else if (role === "admin") {
        router.push("/admin");
      } else {
        router.push("/overview");
      }
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during sign in.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-[360px] flex flex-col items-center">
        {/* Wordmark & Brand Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <Image
            src="/logo.png"
            alt="OpenRiverStack"
            width={32}
            height={32}
            className="rounded-xs"
          />
          <span className="font-serif text-[22px] font-semibold tracking-tight text-ink-950">
            OpenRiverStack
          </span>
        </div>

        {/* Card */}
        <div className="w-full bg-surface border border-ink-100 rounded-md p-6">
          <h1 className="font-serif text-[22px] text-ink-950 mb-5 font-medium">
            Sign in
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[13px] font-medium text-ink-600 font-sans select-none">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[12px] text-ink-500 hover:text-river-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 placeholder:text-ink-400 font-sans focus-visible:outline-none focus-visible:border-river-500 focus-visible:ring-1 focus-visible:ring-river-500"
              />
            </div>

            {error && (
              <div className="p-3 bg-brick-100/70 border border-brick-600 rounded-sm text-[13px] text-brick-800 leading-snug">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="w-full mt-2"
            >
              Sign in
            </Button>
          </form>

          <p className="mt-5 pt-4 border-t border-ink-100 text-[13px] text-ink-600 text-center">
            New here?{" "}
            <Link href="/signup" className="text-river-700 hover:text-river-800 font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center text-ink-500">
          Loading workspace...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
