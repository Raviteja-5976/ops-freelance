import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  AppWindow,
  ArrowRight,
  Boxes,
  BrainCircuit,
  CalendarClock,
  CreditCard,
  FolderOpen,
  ListChecks,
  Mail,
  ReceiptText,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "OpenRiverStack — Service Portal",
  description:
    "OpenRiverStack builds web apps, AI web applications and 3D websites for clients. Follow your project, payments, invoices, files and calls in one portal.",
};

const CONTACT_EMAIL = "founder@openriverstack.com";
const CONTACT_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  "New project enquiry"
)}`;

const services = [
  {
    icon: AppWindow,
    title: "Web apps",
    body: "Dashboards, portals, booking and commerce flows: full-stack apps with auth, payments and the admin side your team actually uses.",
  },
  {
    icon: BrainCircuit,
    title: "AI web applications",
    body: "Assistants, document search, content generation and workflow automation, built into a product your customers can use.",
  },
  {
    icon: Boxes,
    title: "Static & 3D websites",
    body: "Fast marketing sites and immersive 3D experiences that load quickly and hold up on every device.",
  },
  {
    icon: Rocket,
    title: "Products & MVPs",
    body: "Take an idea from scope to launch, then keep shipping. We design, build and deploy end to end.",
  },
];

const features = [
  {
    icon: ListChecks,
    title: "Project timeline",
    body: "See every milestone, what is in progress right now, and the latest update from the team.",
  },
  {
    icon: CreditCard,
    title: "Staged payments",
    body: "Pay each stage online through Razorpay when it falls due. Receipts are recorded the moment it settles.",
  },
  {
    icon: ReceiptText,
    title: "GST invoices",
    body: "Every invoice issued for your project, ready to view and print for your accounts team.",
  },
  {
    icon: FolderOpen,
    title: "Shared files",
    body: "Contracts, designs and deliverables in one place, instead of scattered across email threads.",
  },
  {
    icon: CalendarClock,
    title: "Call scheduling",
    body: "Request a time from our open slots and get an email as soon as it is confirmed.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Your workspace only shows your company's projects. Nothing is visible to other clients.",
  },
];

const steps = [
  {
    title: "Tell us what you need",
    body: `Email ${CONTACT_EMAIL} with your idea. We'll scope it, agree milestones and send a proposal.`,
  },
  {
    title: "Get your workspace",
    body: "Once we start, you're invited to the portal. Sign up with the invited address and confirm it.",
  },
  {
    title: "Follow the build",
    body: "Track milestones, review files, settle each stage and book calls with the team as the work moves.",
  },
];

const sampleMilestones = [
  { title: "Discovery & scope", date: "Sep 2 – Sep 9", state: "done" },
  { title: "Design", date: "Sep 10 – Sep 24", state: "done" },
  { title: "Build", date: "Sep 25 – Oct 20", state: "current" },
  { title: "Launch", date: "Oct 27", state: "upcoming" },
] as const;

async function getPortalHref(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role === "admin" ? "/admin" : "/overview";
}

export default async function HomePage() {
  const portalHref = await getPortalHref();

  return (
    <div className="min-h-screen bg-paper flex flex-col text-ink-950">
      {/* Header */}
      <header className="h-[60px] border-b border-ink-100 bg-paper/90 backdrop-blur sticky top-0 z-30 px-4">
        <div className="max-w-admin mx-auto h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="OpenRiverStack"
              width={26}
              height={26}
              className="rounded-xs"
            />
            <span className="font-serif text-[19px] font-semibold tracking-tight">
              OpenRiverStack
            </span>
            <span className="hidden sm:inline text-[13px] text-ink-500 border-l border-ink-200 pl-2 ml-0.5">
              Service Portal
            </span>
          </Link>

          <nav className="flex items-center gap-1.5">
            <a
              href="#services"
              className="hidden md:inline-flex items-center h-[34px] px-3 text-[14px] text-ink-600 hover:text-ink-950 hover:bg-ink-50 rounded-sm transition-colors"
            >
              Services
            </a>
            <a
              href={CONTACT_HREF}
              className="hidden md:inline-flex items-center h-[34px] px-3 text-[14px] text-ink-600 hover:text-ink-950 hover:bg-ink-50 rounded-sm transition-colors"
            >
              Contact
            </a>
            {portalHref ? (
              <Link
                href={portalHref}
                className="inline-flex items-center gap-1.5 h-[34px] px-3.5 text-[14px] font-medium rounded-sm bg-river-700 text-white hover:bg-river-800 transition-colors"
              >
                Open portal
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center h-[34px] px-3.5 text-[14px] font-medium rounded-sm bg-river-700 text-white hover:bg-river-800 transition-colors"
              >
                Client sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="px-4 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="max-w-admin mx-auto grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-[13px] font-medium text-river-700 bg-river-50 border border-river-100 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-river-500" />
                Web apps · AI applications · 3D websites
              </p>
              <h1 className="mt-6 font-serif text-[40px] sm:text-[56px] leading-[1.05] tracking-tight font-normal">
                OpenRiverStack
                <span className="block text-river-700 italic">Service Portal</span>
              </h1>
              <p className="mt-6 max-w-[54ch] text-[17px] leading-relaxed text-ink-600">
                We&apos;re an independent studio that designs and builds websites
                and products for clients. Once we&apos;re working together, this is
                where you follow the build, review files, settle each stage and
                talk to the team.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href={CONTACT_HREF}
                  className="inline-flex items-center gap-2 h-[44px] px-5 text-[15px] font-medium rounded-sm bg-river-700 text-white hover:bg-river-800 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Start a project
                </a>
                <Link
                  href={portalHref ?? "/login"}
                  className="inline-flex items-center gap-2 h-[44px] px-5 text-[15px] font-medium rounded-sm bg-surface border border-ink-200 hover:bg-ink-50 transition-colors"
                >
                  {portalHref ? "Go to your workspace" : "Client sign in"}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="mt-4 text-[14px] text-ink-500">
                Or write to{" "}
                <a
                  href={CONTACT_HREF}
                  className="text-river-700 underline underline-offset-2 hover:text-river-800"
                >
                  {CONTACT_EMAIL}
                </a>
              </p>
            </div>

            {/* Sample project card */}
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-6 rounded-lg bg-gradient-to-br from-river-50 via-transparent to-transparent"
              />
              <figure className="relative bg-surface border border-ink-100 rounded-md shadow-overlay">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-100">
                  <div>
                    <p className="text-[12px] uppercase tracking-wider text-ink-500">
                      Example project
                    </p>
                    <p className="text-[16px] font-semibold tracking-tight">
                      AI support assistant
                    </p>
                  </div>
                  <span className="text-[12px] font-medium text-river-800 bg-river-50 border border-river-100 rounded-full px-2.5 py-0.5">
                    In progress
                  </span>
                </div>

                <ol className="px-5 py-5 list-none m-0">
                  {sampleMilestones.map((m, idx) => {
                    const isLast = idx === sampleMilestones.length - 1;
                    return (
                      <li key={m.title} className={`relative pl-7 ${isLast ? "" : "pb-5"}`}>
                        {!isLast && (
                          <span
                            className={`absolute left-[5px] top-[14px] bottom-0 w-[2px] ${
                              m.state === "done" ? "bg-river-500" : "bg-ink-100"
                            }`}
                          />
                        )}
                        <span
                          className={`absolute left-0 top-[4px] w-3 h-3 rounded-full border-2 ${
                            m.state === "done"
                              ? "bg-river-500 border-river-500"
                              : m.state === "current"
                              ? "bg-surface border-river-500 ring-4 ring-river-100"
                              : "bg-surface border-ink-300"
                          }`}
                        />
                        <div className="flex items-baseline justify-between gap-4">
                          <span
                            className={`text-[15px] ${
                              m.state === "current"
                                ? "font-semibold"
                                : m.state === "done"
                                ? "text-ink-800"
                                : "text-ink-500"
                            }`}
                          >
                            {m.title}
                          </span>
                          <span className="text-[12px] text-ink-500 tabular-nums whitespace-nowrap">
                            {m.date}
                          </span>
                        </div>
                        {m.state === "current" && (
                          <p className="mt-2 font-serif text-[14px] leading-relaxed text-ink-800 border-l-2 border-river-300 pl-3">
                            Chat widget is live on staging; knowledge-base sync goes to review on Friday.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>

                <div className="flex items-center justify-between px-5 py-3.5 bg-ink-50/60 border-t border-ink-100 rounded-b-md">
                  <div className="flex items-center gap-2.5">
                    <CalendarClock className="w-4 h-4 text-river-700" strokeWidth={1.75} />
                    <div>
                      <p className="text-[12px] text-ink-500">Next call</p>
                      <p className="text-[14px] font-medium">Thu, Oct 9 · 4:00 PM</p>
                    </div>
                  </div>
                  <span className="text-[13px] font-medium text-ink-800 bg-surface border border-ink-200 rounded-sm px-3 py-1.5">
                    3 new files
                  </span>
                </div>
              </figure>
            </div>
          </div>
        </section>

        {/* Services */}
        <section id="services" className="px-4 py-20 bg-surface border-y border-ink-100 scroll-mt-[60px]">
          <div className="max-w-admin mx-auto">
            <div className="max-w-[58ch]">
              <p className="text-[13px] font-medium uppercase tracking-wider text-river-700">
                What we build
              </p>
              <h2 className="mt-2 font-serif text-[30px] sm:text-[36px] leading-tight tracking-tight">
                Websites and products, designed and built end to end
              </h2>
              <p className="mt-3 text-[16px] text-ink-600 leading-relaxed">
                Bring an idea, a half-built product or a site that needs replacing.
                We handle design, development and deployment.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {services.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-md border border-ink-100 bg-paper p-6 flex flex-col"
                >
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-sm bg-river-700 text-white">
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-5 font-serif text-[21px] leading-tight tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Portal features */}
        <section className="px-4 py-20">
          <div className="max-w-admin mx-auto">
            <div className="max-w-[56ch]">
              <p className="text-[13px] font-medium uppercase tracking-wider text-river-700">
                The client portal
              </p>
              <h2 className="mt-2 font-serif text-[30px] sm:text-[36px] leading-tight tracking-tight">
                Everything about your project, in one place
              </h2>
              <p className="mt-3 text-[16px] text-ink-600 leading-relaxed">
                No more digging through email for the latest invoice or the file
                that was sent three weeks ago.
              </p>
            </div>

            <div className="mt-12 grid gap-px bg-ink-100 border border-ink-100 rounded-md overflow-hidden sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <div key={title} className="bg-surface p-6">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-sm bg-river-50 text-river-700">
                    <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold tracking-tight">{title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 pb-20">
          <div className="max-w-admin mx-auto">
            <h2 className="font-serif text-[30px] sm:text-[36px] leading-tight tracking-tight">
              How working with us goes
            </h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3 list-none m-0 p-0">
              {steps.map((s, idx) => (
                <li key={s.title} className="border-t-2 border-river-500 pt-5">
                  <span className="money text-[13px] text-river-700">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-[17px] font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-600 break-words">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Contact CTA */}
        <section id="contact" className="px-4 pb-24 scroll-mt-[60px]">
          <div className="max-w-admin mx-auto rounded-lg bg-ink-950 text-white px-6 py-12 sm:px-12 sm:py-14 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-serif text-[28px] sm:text-[34px] leading-tight tracking-tight">
                Have a project in mind?
              </h2>
              <p className="mt-2 text-[15px] text-ink-300 max-w-[52ch]">
                Tell us what you want to build, whether it&apos;s a web app, an AI
                product or a 3D site, and we&apos;ll come back with a plan and a quote.
              </p>
              <a
                href={CONTACT_HREF}
                className="mt-5 inline-flex items-center gap-2 font-mono text-[15px] sm:text-[17px] text-river-300 hover:text-white transition-colors break-all"
              >
                <Mail className="w-4 h-4 shrink-0" />
                {CONTACT_EMAIL}
              </a>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <a
                href={CONTACT_HREF}
                className="inline-flex items-center justify-center gap-2 h-[44px] px-5 text-[15px] font-medium rounded-sm bg-river-500 text-white hover:bg-river-700 transition-colors"
              >
                Email the founder
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                href={portalHref ?? "/login"}
                className="inline-flex items-center justify-center h-[44px] px-5 text-[15px] font-medium rounded-sm border border-ink-600 text-white hover:bg-ink-800 transition-colors"
              >
                {portalHref ? "Open portal" : "Client sign in"}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-100 px-4 py-8">
        <div className="max-w-admin mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-[13px] text-ink-500">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="" width={18} height={18} className="rounded-xs" />
            <span>© {new Date().getFullYear()} OpenRiverStack</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href={CONTACT_HREF} className="hover:text-ink-950 transition-colors">
              {CONTACT_EMAIL}
            </a>
            <Link href="/login" className="hover:text-ink-950 transition-colors">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-ink-950 transition-colors">
              Create account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
