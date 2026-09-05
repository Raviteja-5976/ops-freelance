"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface UserProfile {
  id: string;
  role: "admin" | "client";
  full_name: string;
  email: string;
  phone?: string | null;
  timezone: string;
  avatar_url?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: "admin" | "client" | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<"admin" | "client" | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrCreateProfile = async (currentUser: User): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (data) {
        return data as UserProfile;
      }

      // If no profile exists yet in the database, insert a default record strictly as 'client'
      const email = currentUser.email || "";

      const initialProfile: UserProfile = {
        id: currentUser.id,
        role: "client",
        full_name:
          currentUser.user_metadata?.full_name ||
          email.split("@")[0]?.replace(/[._]/g, " ") ||
          "User",
        email,
        timezone: "Asia/Kolkata",
      };

      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .upsert(initialProfile)
        .select("*")
        .single();

      if (!insertError && inserted) {
        return inserted as UserProfile;
      }

      return initialProfile;
    } catch (err) {
      console.error("Error fetching user profile:", err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchOrCreateProfile(user);
    if (p) {
      setProfile(p);
      setRole(p.role);
    }
  };

  useEffect(() => {
    let mounted = true;

    // 1. Initial Session Check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        const p = await fetchOrCreateProfile(session.user);
        if (mounted) {
          setProfile(p);
          setRole(p?.role || null);
        }
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    // 2. Auth State Change Listener (persists session & reacts to logins/logouts)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        const p = await fetchOrCreateProfile(session.user);
        if (mounted) {
          setProfile(p);
          setRole(p?.role || null);
        }
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
