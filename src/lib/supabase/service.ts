import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. **Server-side only** — this key bypasses RLS
 * entirely, so it must never be imported into a client component.
 *
 * Used where the browser deliberately has no rights: settling payments (clients
 * have read-only access to `payments`) and creating accounts for invited team
 * members (`profiles.id` is a foreign key onto `auth.users`).
 */
export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    { auth: { persistSession: false } }
  );
}
