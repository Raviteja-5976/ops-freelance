import { redirect } from "next/navigation";

/**
 * Legacy invite URL.
 *
 * Admin invitations now email a Supabase action link that lands on
 * /reset-password to set a password, so this page no longer needs its own
 * duplicate of the sign-up form. Anyone who still reaches it — an old link, a
 * bookmark — is sent to the real sign-up page with their address carried over.
 */
export default function InvitePage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const email = searchParams?.email;
  redirect(email ? `/signup?email=${encodeURIComponent(email)}` : "/signup");
}
