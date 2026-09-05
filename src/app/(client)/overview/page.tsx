"use client";

import React from "react";
import Link from "next/link";
import { TheCurrent } from "@/components/ui/TheCurrent";
import { StatusPill } from "@/components/ui/StatusPill";
import { Button } from "@/components/ui/Button";
import { formatMoney, formatDate } from "@/lib/formatters";
import { useData } from "@/components/providers/DataProvider";
import { useAuth } from "@/components/providers/AuthProvider";

export default function OverviewPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const {
    myClient,
    myProjects,
    selectedProject,
    selectProject,
    milestones: allMilestones,
    updates,
    callRequests,
    payments,
    loading: dataLoading,
  } = useData();
  const loading = authLoading || dataLoading;
  const firstName = profile?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  // Scope project strictly to user's assigned client company
  const client = myClient;
  const userProjects = myProjects;
  const project = selectedProject;

  // Time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-ink-500 font-sans text-sm">
        Loading your workspace...
      </div>
    );
  }

  // If user is not part of any client company or has no visible projects, show clean empty state
  if (!client || !project) {
    return (
      <div className="flex flex-col gap-8 py-6">
        <div>
          <h1 className="font-serif text-[32px] sm:text-[40px] text-ink-950 font-normal tracking-tight leading-[1.1]">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 text-[16px] text-ink-600 font-sans">
            Client Workspace
          </p>
        </div>

        <div className="bg-surface border border-ink-100 rounded-md p-8 sm:p-10 flex flex-col items-center text-center max-w-md mx-auto my-4">
          <div className="w-12 h-12 rounded-full bg-ink-100/70 flex items-center justify-center text-ink-600 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="font-serif text-[22px] text-ink-950 font-medium mb-2">
            {client ? "No project shared yet" : "No workspace assigned"}
          </h2>
          <p className="text-[14px] text-ink-600 font-sans leading-relaxed mb-6">
            {client
              ? `You have access to the ${client.name} workspace, but no project has been shared with you yet. Your studio lead publishes a project once it is ready for you to follow.`
              : `Your account (${user?.email || "logged in"}) is not linked to a client workspace yet. Once your studio lead adds you, your project timeline, stage, and updates will appear here.`}
          </p>
          <a
            href="mailto:founder@openriverstack.com"
            className="text-[13px] text-river-700 hover:text-river-800 font-medium font-sans underline underline-offset-4"
          >
            Contact studio lead (founder@openriverstack.com)
          </a>
        </div>
      </div>
    );
  }

  const milestones = allMilestones.filter(
    (m) => m.project_id === project.id && m.visible_to_client
  );
  const latestUpdate = updates
    .filter((u) => u.project_id === project.id && u.published_at)
    .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())[0];

  const confirmedCalls = callRequests.filter(
    (c) => c.client_id === client.id && c.status === "confirmed" && c.confirmed_start
  );
  const nextCall = confirmedCalls[0];

  // Financial calculations
  const totalValue = project.total_value;
  const paidPayments = payments.filter(
    (p) => p.project_id === project.id && p.status === "paid"
  );
  const paidAmount = paidPayments.reduce((acc, p) => acc + p.amount, 0);
  const outstandingAmount = Math.max(0, totalValue - paidAmount);

  return (
    <div className="flex flex-col gap-10">
      {/* 1. Greeting & Project Heading */}
      <div>
        <h1 className="font-serif text-[32px] sm:text-[40px] text-ink-950 font-normal tracking-tight leading-[1.1]">
          {getGreeting()}, {firstName}
        </h1>
        <p className="mt-1 text-[16px] text-ink-600 font-sans">
          {client.name} · {project.name}
        </p>
      </div>

      {/* 1b. All projects, when more than one is shared */}
      {myProjects.length > 1 && (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[13px] uppercase tracking-wider font-semibold text-ink-500">
              Your projects
            </h2>
            <span className="text-[12px] text-ink-500 font-sans">
              {myProjects.length} active
            </span>
          </div>
          <div className="border border-ink-100 rounded-md divide-y divide-ink-100 bg-surface overflow-hidden">
            {myProjects.map((proj) => {
              const isCurrent = proj.id === project.id;
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => selectProject(proj.id)}
                  className={`w-full text-left p-4 flex items-center justify-between gap-4 transition-colors ${
                    isCurrent ? "bg-river-50/60" : "hover:bg-ink-50/50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-950 text-[15px] truncate">
                        {proj.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-river-700 text-white font-sans shrink-0">
                          Viewing
                        </span>
                      )}
                    </div>
                    {proj.summary && (
                      <p className="text-[13px] text-ink-500 mt-0.5 truncate">
                        {proj.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusPill status={proj.status} />
                    <span className="font-mono text-[14px] text-ink-700 tabular-nums w-11 text-right">
                      {proj.progress}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Status & Percentage */}
      <div className="flex items-baseline justify-between border-b border-ink-100 pb-5">
        <StatusPill status={project.status} />
        <div className="flex items-baseline gap-1">
          <span className="font-serif text-[32px] font-normal text-ink-950 tracking-tight leading-none">
            {project.progress}
          </span>
          <span className="text-[16px] text-ink-500 font-sans">%</span>
        </div>
      </div>

      {/* 3. The Current: Signature Stage & Latest Update */}
      <div>
        <div className="text-[13px] uppercase tracking-wider text-ink-500 font-sans font-medium mb-1">
          Current Stage
        </div>
        <TheCurrent
          milestones={milestones}
          compact={true}
          latestUpdate={latestUpdate?.body}
          updateDate={
            latestUpdate?.published_at
              ? formatDate(latestUpdate.published_at, "short")
              : undefined
          }
        />
      </div>

      {/* 4. Expected Delivery */}
      <div className="border-y border-ink-100 py-4 flex items-center justify-between">
        <span className="text-[15px] text-ink-600 font-sans">Delivery expected</span>
        <span className="text-[16px] text-ink-950 font-medium font-sans">
          {formatDate(project.expected_delivery, "full")}
        </span>
      </div>

      {/* 5. Payment Summary Card */}
      <div className="bg-surface border border-ink-100 rounded-md p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-medium text-ink-950">
              {formatMoney(paidAmount)} paid of {formatMoney(totalValue)}
            </span>
            {outstandingAmount > 0 ? (
              <span className="text-[14px] text-ink-600">
                {formatMoney(outstandingAmount)} due on delivery
              </span>
            ) : (
              <span className="text-[14px] text-river-700 font-medium">
                Paid in full
              </span>
            )}
          </div>
          <Link href="/payments">
            <Button variant="secondary" size="md">
              View payments
            </Button>
          </Link>
        </div>
      </div>

      {/* 6. Scheduled Next Call or Booking Request */}
      <div className="bg-surface border border-ink-100 rounded-md p-6 flex flex-col gap-4">
        {nextCall ? (
          <div>
            <span className="text-[13px] text-ink-500 font-sans uppercase tracking-wider block mb-1">
              Your next call
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
              <div>
                <p className="text-[16px] font-medium text-ink-950">
                  {formatDate(nextCall.confirmed_start, "datetime")}
                </p>
                <p className="text-[14px] text-ink-600 mt-0.5">{nextCall.reason}</p>
              </div>
              {nextCall.meeting_url && (
                <a
                  href={nextCall.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="primary" size="md">
                    Join call ↗
                  </Button>
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[16px] font-medium text-ink-950">
                Need to talk something through?
              </p>
              <p className="text-[14px] text-ink-600 mt-0.5">
                Book a 30-minute video slot directly with OpenRiverStack.
              </p>
            </div>
            <Link href="/calls/new">
              <Button variant="secondary" size="md">
                Request a call
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
