"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";


export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");

    try {
      // Goes through our own API rather than resetPasswordForEmail: Supabase's
      // built-in mailer caps auth emails at a few per hour.
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json();

      if (!res.ok || !body.success) {
        setError(body.error || "Could not send the reset link.");
      } else {
        setSubmitted(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to request password reset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-[360px] flex flex-col items-center">
        <div className="flex items-center gap-2.5 mb-8">
          <Image src="/logo.png" alt="OpenRiverStack" width={32} height={32} className="rounded-xs" />
          <span className="font-serif text-[22px] font-semibold tracking-tight text-ink-950">
            OpenRiverStack
          </span>
        </div>

        <div className="w-full bg-surface border border-ink-100 rounded-md p-6">
          <h1 className="font-serif text-[22px] text-ink-950 mb-3 font-medium">
            Reset password
          </h1>

          {submitted ? (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] text-ink-800 font-sans leading-relaxed">
                If that email has an account, a reset link is on its way.
              </p>
              <Link href="/login">
                <Button variant="secondary" size="md" className="w-full">
                  Return to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-[13px] text-ink-600 font-sans leading-relaxed">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
              <Input
                label="Email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
              {error && (
                <div className="p-3 bg-brick-100/70 border border-brick-600 rounded-sm text-[13px] text-brick-800 leading-snug">
                  {error}
                </div>
              )}
              <Button type="submit" variant="primary" size="md" loading={loading} className="w-full mt-2">
                Send reset link
              </Button>
              <div className="text-center mt-1">
                <Link href="/login" className="text-[13px] text-ink-500 hover:text-river-700">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
