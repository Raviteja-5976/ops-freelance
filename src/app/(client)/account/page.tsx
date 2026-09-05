"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setTimezone(profile.timezone || "Asia/Kolkata");
    } else if (user) {
      setFullName(user.user_metadata?.full_name || user.email?.split("@")[0] || "");
    }
  }, [profile, user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const supabase = createClient();

      // 1. Update public.profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          timezone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) {
        throw new Error(profileError.message);
      }

      // 2. Update password if provided
      if (password.trim()) {
        if (password.trim().length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }
        const { error: pwdError } = await supabase.auth.updateUser({
          password: password.trim(),
        });
        if (pwdError) {
          throw new Error(pwdError.message);
        }
        setPassword("");
      }

      await refreshProfile();
      showToast("Account details updated successfully");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-[500px]">
      <div>
        <h1 className="font-serif text-[32px] text-ink-950 font-normal">
          Account
        </h1>
        <p className="text-[14px] text-ink-600 font-sans mt-0.5">
          Your profile and authentication settings.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-5 border-t border-ink-100 pt-6">
        <Input
          label="Email address"
          disabled
          value={user?.email || profile?.email || "user@company.com"}
          helperText="Email is managed by OpenRiverStack administration"
        />

        <Input
          label="Full name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />

        <Input
          label="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 98765 43210"
        />

        <div className="flex flex-col gap-1">
          <label className="text-[13px] font-medium text-ink-600 font-sans">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="h-[38px] px-3 bg-surface border border-ink-200 rounded-sm text-[14px] text-ink-950 font-sans focus-visible:outline-none focus-visible:border-river-500 focus-visible:ring-1 focus-visible:ring-river-500"
          >
            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
            <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
            <option value="Europe/London">Europe/London (GMT/BST)</option>
            <option value="America/New_York">America/New_York (EST/EDT)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
          </select>
        </div>

        <div className="border-t border-ink-100 pt-5">
          <Input
            label="Change password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep existing"
            helperText="Minimum 6 characters"
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button type="submit" variant="primary" size="md" loading={saving}>
            Save changes
          </Button>

          <Button
            type="button"
            variant="quiet"
            size="md"
            onClick={signOut}
          >
            Sign out
          </Button>
        </div>
      </form>
    </div>
  );
}
