"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DataSnapshot, emptySnapshot, fetchSnapshot } from "@/lib/db";
import { useAuth } from "@/components/providers/AuthProvider";
import { Client, Project } from "@/types/database";

interface DataContextType extends DataSnapshot {
  loading: boolean;
  error: string | null;
  /** The client company the signed-in user belongs to, for the client portal. */
  myClient: Client | null;
  /** Projects of that client which have been made visible to them. */
  myProjects: Project[];
  /** The project the client portal is currently showing. */
  selectedProject: Project | null;
  /** Switches which project the client portal is showing. */
  selectProject: (projectId: string) => void;
  /** Re-reads everything from Supabase. Call after any mutation. */
  refresh: () => Promise<void>;
}

const SELECTED_PROJECT_KEY = "ors.selectedProjectId";

const DataContext = createContext<DataContextType>({
  ...emptySnapshot,
  loading: true,
  error: null,
  myClient: null,
  myProjects: [],
  selectedProject: null,
  selectProject: () => {},
  refresh: async () => {},
});

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [snapshot, setSnapshot] = useState<DataSnapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Remember the chosen project across page loads so switching does not reset
  // every time they navigate.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SELECTED_PROJECT_KEY);
      if (stored) setSelectedProjectId(stored);
    } catch {
      // Private browsing or blocked storage: fall back to the first project.
    }
  }, []);

  const selectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    try {
      window.localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
    } catch {
      // Non-fatal; the choice just will not survive a reload.
    }
  }, []);

  const load = useCallback(async () => {
    // Every table is behind RLS, so there is nothing to read until the session
    // is known. Signed out means an empty workspace, not an error.
    if (!user) {
      setSnapshot(emptySnapshot);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const next = await fetchSnapshot();
      setSnapshot(next);
    } catch (err) {
      setSnapshot(emptySnapshot);
      setError(err instanceof Error ? err.message : "Could not load workspace data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    void load();
  }, [authLoading, load]);

  // RLS already limits a client's session to their own rows, but the admin
  // session sees everything — so resolve membership explicitly rather than
  // assuming the first row belongs to the viewer.
  const myClient = useMemo(() => {
    if (!user) return null;

    const membership = snapshot.clientMembers.find(
      (cm) => cm.profile_id === user.id
    );
    if (membership) {
      return snapshot.clients.find((c) => c.id === membership.client_id) || null;
    }

    // Fall back to the client's own contact address for people who have an
    // account but have not been linked as a member yet.
    const email = user.email?.toLowerCase();
    if (!email) return null;
    return (
      snapshot.clients.find((c) => c.email?.toLowerCase() === email) || null
    );
  }, [user, snapshot.clientMembers, snapshot.clients]);

  const myProjects = useMemo(() => {
    if (!myClient) return [];
    return snapshot.projects.filter(
      (p) => p.client_id === myClient.id && p.visible_to_client
    );
  }, [myClient, snapshot.projects]);

  // Fall back to the first project whenever the stored id is gone — the project
  // may have been hidden, deleted, or belong to a different client entirely.
  const selectedProject = useMemo(() => {
    if (myProjects.length === 0) return null;
    return (
      myProjects.find((p) => p.id === selectedProjectId) || myProjects[0]
    );
  }, [myProjects, selectedProjectId]);

  return (
    <DataContext.Provider
      value={{
        ...snapshot,
        loading,
        error,
        myClient,
        myProjects,
        selectedProject,
        selectProject,
        refresh: load,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
