"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useData } from "@/components/providers/DataProvider";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const { myProjects, selectedProject, selectProject } = useData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Client";
  const displayEmail = user?.email || profile?.email || "";

  const navItems = [
    { label: "Overview", href: "/overview" },
    { label: "Project", href: "/project" },
    { label: "Payments", href: "/payments" },
    { label: "Invoices", href: "/invoices" },
    { label: "Files", href: "/files" },
    { label: "Calls", href: "/calls" },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col text-ink-950">
      {/* 52px Header */}
      <header className="h-[52px] bg-paper border-b border-ink-100 sticky top-0 z-30 px-4">
        <div className="max-w-[680px] mx-auto h-full flex items-center justify-between">
          <Link href="/overview" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="OpenRiverStack"
              width={24}
              height={24}
              className="rounded-xs"
            />
            <span className="font-serif text-[18px] font-semibold tracking-tight text-ink-950">
              OpenRiverStack
            </span>
          </Link>

          {/* User / Profile Avatar Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-1.5 text-[14px] text-ink-800 hover:text-ink-950 font-medium py-1 px-2 rounded-sm hover:bg-ink-50 transition-colors"
            >
              <span>{displayName}</span>
              <svg
                className={`w-3.5 h-3.5 text-ink-500 transition-transform ${
                  menuOpen ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 mt-1 w-48 bg-surface border border-ink-100 rounded-md shadow-overlay z-30 py-1 text-[13px]">
                  <div className="px-3 py-2 border-b border-ink-100">
                    <p className="font-medium text-ink-950 truncate">{displayName}</p>
                    <p className="text-ink-500 text-[12px] truncate">{displayEmail}</p>
                  </div>
                  <Link
                    href="/account"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-ink-700 hover:bg-ink-50 hover:text-ink-950"
                  >
                    Account settings
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleSignOut();
                    }}
                    className="w-full text-left px-3 py-2 text-ink-600 hover:bg-ink-50 hover:text-brick-800 border-t border-ink-100"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Sub-nav (36px desktop) */}
      <nav className="border-b border-ink-100 bg-paper sticky top-[52px] z-20 px-4">
        <div className="max-w-[680px] mx-auto flex items-center gap-6 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/overview" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-2 text-[14px] font-sans transition-colors whitespace-nowrap relative ${
                  isActive
                    ? "text-ink-950 font-medium"
                    : "text-ink-600 hover:text-ink-950"
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-river-700 rounded-full" />
                )}
              </Link>
            );
          })}

          {/* Project switcher — only when more than one project is shared */}
          {myProjects.length > 1 && (
            <div className="relative ml-auto py-1.5 shrink-0">
              <button
                onClick={() => setProjectMenuOpen(!projectMenuOpen)}
                className="flex items-center gap-1.5 max-w-[220px] text-[13px] text-ink-700 hover:text-ink-950 font-medium border border-ink-200 rounded-sm px-2.5 py-1 bg-surface transition-colors"
              >
                <span className="truncate">
                  {selectedProject?.name || "Select project"}
                </span>
                <svg
                  className={`w-3 h-3 shrink-0 text-ink-500 transition-transform ${
                    projectMenuOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {projectMenuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setProjectMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-64 bg-surface border border-ink-100 rounded-md shadow-overlay z-30 py-1 text-[13px]">
                    <p className="px-3 py-1.5 text-[11px] uppercase tracking-wider text-ink-500 border-b border-ink-100">
                      Your projects ({myProjects.length})
                    </p>
                    {myProjects.map((proj) => (
                      <button
                        key={proj.id}
                        onClick={() => {
                          selectProject(proj.id);
                          setProjectMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-ink-50 flex items-start gap-2 ${
                          proj.id === selectedProject?.id
                            ? "text-ink-950 font-medium"
                            : "text-ink-700"
                        }`}
                      >
                        <span className="w-3 shrink-0 text-river-700">
                          {proj.id === selectedProject?.id ? "✓" : ""}
                        </span>
                        <span className="flex-1">
                          <span className="block truncate">{proj.name}</span>
                          <span className="block text-[11px] text-ink-500 capitalize">
                            {proj.status.replace("_", " ")} · {proj.progress}%
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Main Content Area (680px centered column) */}
      <main className="flex-1 max-w-[680px] w-full mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-ink-100 py-6 px-4 text-center text-[12px] text-ink-500 font-sans">
        <p>OpenRiverStack Studio · Private Client Workspace</p>
      </footer>
    </div>
  );
}
