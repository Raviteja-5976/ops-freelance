import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { sendWorkspaceInviteEmail } from "@/lib/email";

/**
 * Grants someone access to a client workspace by email address.
 *
 * `profiles.id` is a foreign key onto `auth.users`, so a membership row cannot
 * exist before the person has an account. The browser has no way to create one,
 * which is why this runs server-side with the service role:
 *
 *   - existing account  -> link it and tell them they now have access
 *   - unknown address   -> create the account, email a set-password link, link it
 *
 * Admin only. Everything is idempotent so re-adding somebody is harmless.
 */
export async function POST(req: NextRequest) {
  try {
    const { clientId, email } = await req.json();

    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!clientId || !cleanEmail) {
      return NextResponse.json(
        { success: false, error: "Client and email address are both required." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "That does not look like a valid email address." },
        { status: 400 }
      );
    }

    // 1. Only an admin may hand out workspace access.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Not signed in." }, { status: 401 });
    }

    const admin = serviceClient();
    const { data: actor } = await admin
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (actor?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Admins only." }, { status: 403 });
    }

    const { data: client } = await admin
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) {
      return NextResponse.json({ success: false, error: "Client not found." }, { status: 404 });
    }

    // 2. Find the person, or create an account for them.
    let profile = (
      await admin.from("profiles").select("id, email, role").ilike("email", cleanEmail).maybeSingle()
    ).data;

    let isExistingUser = Boolean(profile);
    let actionLink: string | null = null;

    if (!profile) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "invite",
        email: cleanEmail,
        options: { redirectTo: `${appUrl}/reset-password` },
      });

      if (linkErr || !link?.user) {
        return NextResponse.json(
          { success: false, error: linkErr?.message || "Could not create that account." },
          { status: 500 }
        );
      }

      actionLink = link.properties?.action_link || null;

      // `handle_new_user` may already have written a profile row; upsert either
      // way, but never downgrade an existing admin to a client.
      const { data: created, error: profErr } = await admin
        .from("profiles")
        .upsert(
          {
            id: link.user.id,
            role: "client",
            full_name: cleanEmail.split("@")[0].replace(/[._]/g, " "),
            email: cleanEmail,
            timezone: "Asia/Kolkata",
          },
          { onConflict: "id" }
        )
        .select("id, email, role")
        .single();

      if (profErr || !created) {
        return NextResponse.json(
          { success: false, error: profErr?.message || "Could not create their profile." },
          { status: 500 }
        );
      }
      profile = created;
      isExistingUser = false;
    }

    // 3. Link them to the workspace. First person in becomes primary contact.
    const { count } = await admin
      .from("client_members")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);

    const { error: memberErr } = await admin.from("client_members").upsert(
      {
        client_id: clientId,
        profile_id: profile.id,
        is_primary: (count ?? 0) === 0,
      },
      { onConflict: "client_id,profile_id" }
    );

    if (memberErr) {
      return NextResponse.json({ success: false, error: memberErr.message }, { status: 500 });
    }

    // 4. Tell them. A failed email must not undo the access that was granted.
    let emailed = false;
    try {
      const res = await sendWorkspaceInviteEmail({
        recipientEmail: cleanEmail,
        clientName: client.name,
        actionLink,
        invitedByName: actor?.full_name || undefined,
        isExistingUser,
      });
      emailed = res.success;
    } catch {
      emailed = false;
    }

    return NextResponse.json({
      success: true,
      isExistingUser,
      emailed,
      email: cleanEmail,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Could not add that person." },
      { status: 500 }
    );
  }
}
