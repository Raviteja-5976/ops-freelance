"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: password.trim(),
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
      } else {
        router.push("/overview");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update password");
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
            Set new password
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="New password"
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (e.target.value.length >= 10) setError("");
              }}
              helperText="Minimum 10 characters"
              error={error}
            />
            <Button type="submit" variant="primary" size="md" loading={loading} className="w-full mt-2">
              Save password
            </Button>
            <div className="text-center mt-1">
              <Link href="/login" className="text-[13px] text-ink-500 hover:text-river-700">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
