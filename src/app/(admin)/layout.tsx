"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { formatMoney } from "@/lib/formatters";
import { useData } from "@/components/providers/DataProvider";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, role, loading, signOut } = useAuth();
  const { callRequests, invoices, payments } = useData();

  useEffect(() => {
    if (!loading && role !== "admin") {
      router.replace("/overview");
    }
  }, [loading, role, router]);

  if (loading || role !== "admin") {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-ink-500 font-sans text-[13px]">
        Checking admin permissions...
      </div>
    );
  }

  const adminName = profile?.full_name || user?.email?.split("@")[0] || "Admin";
  const adminEmail = user?.email || profile?.email || "";

  // Live metrics for navigation counts
  const pendingCallsCount = callRequests.filter(
    (c) => c.status === "pending"
  ).length;

  const draftInvoicesCount = invoices.filter(
    (i) => i.status === "draft"
  ).length;

  const duePayments = payments.filter(
    (p) => p.status === "due" || p.status === "scheduled"
  );
  const totalDueAmount = duePayments.reduce((acc, p) => acc + p.amount, 0);

  const navSections = [
    {
      items: [
        { label: "Dashboard", href: "/admin", badge: null },
      ],
    },
    {
      items: [
        { label: "Clients", href: "/admin/clients", badge: null },
        { label: "Projects", href: "/admin/projects", badge: null },
      ],
    },
    {
      items: [
        {
          label: "Invoices",
          href: "/admin/invoices",
          badge: draftInvoicesCount > 0 ? `${draftInvoicesCount} draft` : null,
        },
        {
          label: "Payments",
          href: "/admin/payments",
          badge: totalDueAmount > 0 ? `${formatMoney(totalDueAmount)} due` : null,
        },
      ],
    },
    {
      items: [
        {
          label: "Calls",
          href: "/admin/calls",
          badge: pendingCallsCount > 0 ? `${pendingCallsCount} pending` : null,
        },
        { label: "Files", href: "/admin/files", badge: null },
      ],
    },
    {
      items: [
        { label: "Activity", href: "/admin/activity", badge: null },
        { label: "Settings", href: "/admin/settings", badge: null },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-paper flex flex-col md:flex-row text-ink-950 font-sans">
      {/* 236px Fixed Left Navigation Rail */}
      <aside className="w-full md:w-[236px] bg-ink-50/70 border-r border-ink-100 flex flex-col justify-between shrink-0">
        <div>
          {/* Header */}
          <div className="h-[52px] px-5 flex items-center justify-between border-b border-ink-100">
            <Link href="/admin" className="flex items-center gap-2">
              <Image src="/logo.png" alt="OpenRiverStack" width={22} height={22} className="rounded-xs" />
              <span className="font-serif text-[16px] font-semibold tracking-tight text-ink-950">
                OpenRiverStack
              </span>
            </Link>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-xs bg-ink-200/50 text-ink-700">
              Admin
            </span>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 flex flex-col gap-3">
            {navSections.map((section, sIdx) => (
              <div key={sIdx} className="flex flex-col gap-0.5">
                {sIdx > 0 && <div className="h-px bg-ink-100 my-1 mx-2" />}
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-sm text-[13px] font-medium transition-colors ${
                        isActive
                          ? "bg-surface text-ink-950 font-semibold border-l-2 border-river-700 shadow-sm"
                          : "text-ink-700 hover:bg-ink-100/60 hover:text-ink-950"
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="font-mono text-[11px] text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded-xs">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Footer Admin User Info & Real Sign Out */}
        <div className="p-3 border-t border-ink-100 bg-ink-50/40 text-[12px]">
          <div className="px-2 py-1.5 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-ink-800 font-medium truncate leading-tight">
                {adminName}
              </p>
              {adminEmail && (
                <p className="text-ink-500 text-[11px] truncate leading-tight">
                  {adminEmail}
                </p>
              )}
            </div>
            <button
              onClick={signOut}
              className="text-ink-500 hover:text-brick-800 text-[11px] shrink-0 font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Admin Content Area (max 1240px fluid) */}
      <main className="flex-1 max-w-[1240px] w-full p-6 sm:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
