import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured yet, let request proceed
  if (!url || !anonKey || url.includes("placeholder") || !url.startsWith("http")) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isProtectedClient =
    pathname.startsWith("/overview") ||
    pathname.startsWith("/project") ||
    pathname.startsWith("/payments") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/files") ||
    pathname.startsWith("/calls") ||
    pathname.startsWith("/account");

  const isProtectedAdmin = pathname.startsWith("/admin");

  // 1. Unauthenticated users cannot access protected routes
  if (!user && (isProtectedClient || isProtectedAdmin)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Strict Role Enforcement based exclusively on database profiles.role
  if (user) {
    if (isProtectedAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      // Only allow access if role is strictly 'admin' in Supabase
      if (profile?.role !== "admin") {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/overview";
        return NextResponse.redirect(redirectUrl);
      }
    }

    // Already signed in and landing on sign-in or sign-up: send them to their
    // own portal instead, based strictly on profiles.role.
    if (pathname === "/login" || pathname === "/signup") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = profile?.role === "admin" ? "/admin" : "/overview";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
