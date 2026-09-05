"use client";

import React, { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function SignUpForm() {
  const searchParams = useSearchParams();

  // An invite link carries the address it was sent to; otherwise they type it.
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");
    try {
      // Goes through our own API rather than supabase.auth.signUp: Supabase's
      // built-in mailer caps auth emails at a few per hour, which blocks real
      // sign-ups with "email rate limit exceeded".
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim(),
        }),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        setError(body.error || "Could not create your account.");
        return;
      }

      setNotice(
        `Check ${email.trim()} for a confirmation link. You will be able to sign in once you have confirmed the address.`
      );
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create your account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-[380px] flex flex-col items-center">
        <div className="flex items-center gap-2.5 mb-8">
          <Image src="/logo.png" alt="OpenRiverStack" width={32} height={32} className="rounded-xs" />
          <span className="font-serif text-[22px] font-semibold tracking-tight text-ink-950">
            OpenRiverStack
          </span>
        </div>

        <div className="w-full bg-surface border border-ink-100 rounded-md p-6">
          <h1 className="font-serif text-[22px] text-ink-950 mb-1 font-medium">
            Create your account
          </h1>
          <p className="text-[13px] text-ink-500 font-sans mb-5 leading-snug">
            For clients of OpenRiverStack Studio.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Your name"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ananya Rao"
            />
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
            <Input
              label="Password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (e.target.value.length >= 10) setError("");
              }}
              helperText="Minimum 10 characters"
            />
            <Input
              label="Confirm password"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={error}
            />

            {notice && (
              <div className="p-3 bg-river-50 border border-river-700/30 rounded-sm text-[13px] text-river-800">
                {notice}{" "}
                <Link href="/login" className="underline underline-offset-2 font-medium">
                  Go to sign in
                </Link>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              className="w-full mt-2"
            >
              Create account
            </Button>
          </form>

          <p className="mt-5 pt-4 border-t border-ink-100 text-[13px] text-ink-600 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-river-700 hover:text-river-800 font-medium">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-4 text-[12px] text-ink-500 leading-snug text-center max-w-[320px]">
          Your studio lead links your account to a client workspace. Until then
          the portal will look empty.
        </p>
      </div>
    </div>
  );
}

// useSearchParams opts the subtree into client rendering, so it needs a
// Suspense boundary for the page to prerender.
export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-paper flex items-center justify-center text-ink-500 font-sans text-[13px]">
          Loading...
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
