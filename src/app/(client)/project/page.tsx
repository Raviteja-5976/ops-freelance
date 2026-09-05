"use client";

import React from "react";
import { TheCurrent } from "@/components/ui/TheCurrent";
import { useData } from "@/components/providers/DataProvider";
import { useAuth } from "@/components/providers/AuthProvider";

export default function ProjectPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    myClient,
    myProjects,
    selectedProject,
    milestones: allMilestones,
    features: allFeatures,
    technologies: allTechnologies,
    loading: dataLoading,
  } = useData();
  const loading = authLoading || dataLoading;
  const client = myClient;
  const userProjects = myProjects;
  const project = selectedProject;

  if (loading) {
    return (
      <div className="py-16 text-center text-ink-500 font-sans text-sm">
        Loading project specifications...
      </div>
    );
  }

  if (!client || !project) {
    return (
      <div className="py-12 flex flex-col items-center text-center max-w-md mx-auto">
        <h1 className="font-serif text-[28px] text-ink-950 font-normal">
          {client ? "No project shared yet" : "No workspace assigned"}
        </h1>
        <p className="mt-3 text-[14px] text-ink-600 font-sans leading-relaxed">
          {client
            ? `You have access to the ${client.name} workspace, but no project has been shared with you yet. Deliverables, scope, and technical stack appear here once your studio lead publishes one.`
            : "Your account is not linked to a client workspace yet. Deliverables, scope, and technical stack will appear here once your studio lead adds you."}
        </p>
      </div>
    );
  }

  const milestones = allMilestones.filter(
    (m) => m.project_id === project.id && m.visible_to_client
  );
  const features = allFeatures.filter((f) => f.project_id === project.id);
  const technologies = allTechnologies.filter((t) => t.project_id === project.id);

  const includedFeatures = features.filter((f) => f.included);
  const excludedFeatures = features.filter((f) => !f.included);

  return (
    <div className="flex flex-col gap-12">
      {/* 1. Project Title & Description */}
      <div>
        <div className="text-[13px] text-ink-500 font-sans mb-1">
          {client.name}
        </div>
        <h1 className="font-serif text-[32px] sm:text-[38px] text-ink-950 font-normal tracking-tight">
          {project.name}
        </h1>
        <div className="mt-4 font-serif text-[18px] leading-[1.65] text-ink-800 whitespace-pre-line max-w-[68ch]">
          {project.description}
        </div>
      </div>

      {/* 2. What's Included & Out of Scope */}
      <div className="border-t border-ink-100 pt-8">
        <h2 className="font-serif text-[22px] text-ink-950 font-medium mb-4">
          What&apos;s included
        </h2>
        <ul className="flex flex-col gap-2.5 list-none p-0 m-0 text-[15px] font-sans">
          {includedFeatures.map((f) => (
            <li key={f.id} className="flex items-start gap-3">
              <span className="text-river-700 font-bold select-none">✓</span>
              <div>
                <span className="text-ink-950 font-medium">{f.label}</span>
                {f.note && (
                  <span className="text-ink-500 ml-1.5 text-[14px]">— {f.note}</span>
                )}
              </div>
            </li>
          ))}

          {excludedFeatures.map((f) => (
            <li key={f.id} className="flex items-start gap-3 text-ink-500">
              <span className="text-ink-400 font-bold select-none">✕</span>
              <div>
                <span>Not included — {f.label}</span>
                {f.note && (
                  <span className="text-ink-400 ml-1.5 text-[13px]">({f.note})</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 3. Built With (Technologies) */}
      <div className="border-t border-ink-100 pt-8">
        <h2 className="font-serif text-[22px] text-ink-950 font-medium mb-4">
          Built with
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-[14px]">
          {technologies.map((t) => (
            <div key={t.id} className="flex items-baseline justify-between border-b border-ink-100/60 pb-2">
              <dt className="text-ink-500 font-sans">{t.area}</dt>
              <dd className="text-ink-950 font-medium font-sans">{t.name}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 4. Complete Milestone Timeline (The Current) */}
      <div className="border-t border-ink-100 pt-8">
        <h2 className="font-serif text-[22px] text-ink-950 font-medium mb-4">
          Timeline
        </h2>
        <p className="text-[14px] text-ink-600 font-sans mb-4">
          Every phase of your project, dated and tracked from kickoff to launch.
        </p>
        <TheCurrent milestones={milestones} compact={false} />
      </div>
    </div>
  );
}
