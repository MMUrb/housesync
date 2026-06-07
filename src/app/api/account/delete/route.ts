import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Permanently deletes the signed-in user's own account. Deleting an auth user
// needs the service-role key, so it runs here on the server (never the browser).
// ON DELETE CASCADE in the schema removes their profile, memberships, splits
// and account settings; houses they created stay for the remaining members.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json(
      { error: "Account deletion isn't configured on the server yet (missing service-role key)." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clear the now-defunct session cookie.
  try {
    await supabase.auth.signOut();
  } catch {
    /* session already invalid — fine */
  }

  return NextResponse.json({ ok: true });
}
