// Verifies the deployment environment before `next build` runs.
//
// This matters most for the NEXT_PUBLIC_* variables: Next.js inlines those into
// the client bundle at build time, so if they are missing the deploy "succeeds"
// and ships an app permanently pointed at a placeholder Supabase project. Far
// better to fail the build with a clear message.
//
//   Amplify : runs automatically from amplify.yml
//   Locally : npm run check-env

const REQUIRED = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    why: "Baked into the browser bundle; without it the app talks to a placeholder project.",
    validate: (v) =>
      v.startsWith("https://") && !v.includes("placeholder") && !v.includes("your-project"),
    expected: "https://<project-ref>.supabase.co",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    why: "Baked into the browser bundle; every client-side query needs it.",
    validate: (v) => v.length > 40 && !v.includes("your-anon-key"),
    expected: "the anon/public key from Supabase → Settings → API",
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    why: "Used for links in emails and for auth redirect targets. A wrong value sends clients to the wrong site.",
    validate: (v) => v.startsWith("http://") || v.startsWith("https://"),
    expected: "https://<your-amplify-domain>  (no trailing slash)",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    why: "Server-side only. Settles payments, issues invoices, and creates invited accounts.",
    validate: (v) => v.length > 40 && !v.includes("your-service-role-key"),
    expected: "the service_role key from Supabase → Settings → API",
  },
];

// Missing these degrades a feature but still yields a working deployment.
const OPTIONAL = [
  { name: "SMTP_HOST", feature: "transactional email (invoices, receipts, invites, password resets)" },
  { name: "SMTP_USER", feature: "transactional email" },
  { name: "SMTP_PASSWORD", feature: "transactional email" },
  { name: "EMAIL_FROM", feature: "the From address on outgoing email" },
  { name: "FOUNDER_EMAIL", feature: "payment and call-request alerts to the studio" },
  { name: "RAZORPAY_KEY_ID", feature: "online card/UPI payments" },
  { name: "RAZORPAY_KEY_SECRET", feature: "online payments" },
  { name: "RAZORPAY_WEBHOOK_SECRET", feature: "payment webhooks (payments captured after the browser closes)" },
];

const problems = [];
for (const { name, why, validate, expected } of REQUIRED) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    problems.push(`  ${name} is not set\n      ${why}\n      Expected: ${expected}`);
  } else if (validate && !validate(value.trim())) {
    problems.push(
      `  ${name} looks like a placeholder or is malformed\n      ${why}\n      Expected: ${expected}`
    );
  }
}

const missingOptional = OPTIONAL.filter((o) => !process.env[o.name]?.trim());

if (missingOptional.length > 0) {
  console.warn("\nEnvironment warnings — the build will continue:\n");
  for (const { name, feature } of missingOptional) {
    console.warn(`  ${name} is not set — ${feature} will not work.`);
  }
  console.warn("");
}

if (problems.length > 0) {
  console.error("\nMissing or invalid required environment variables:\n");
  console.error(problems.join("\n\n"));
  console.error(
    "\nSet these in the Amplify console under App settings → Environment variables,\n" +
      "then redeploy. See README.md for the full list.\n"
  );
  process.exit(1);
}

console.log(
  `Environment looks good (${REQUIRED.length} required set, ` +
    `${OPTIONAL.length - missingOptional.length}/${OPTIONAL.length} optional set).`
);
