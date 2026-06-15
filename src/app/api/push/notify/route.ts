import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUsers } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called by the chat client right after it posts a message: notify the other
// house members. Membership is enforced via RLS — a non-member can't read the
// house's members, so they can't trigger a notification for it.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { houseId?: string; preview?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* ignore */
  }
  const houseId = body.houseId;
  if (!houseId) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const { data: members } = await supabase
    .from("house_members")
    .select("user_id")
    .eq("house_id", houseId);
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (!ids.includes(user.id)) return NextResponse.json({ error: "Not a member." }, { status: 403 });
  const others = ids.filter((id) => id !== user.id);
  if (others.length === 0) return NextResponse.json({ ok: true });

  const [{ data: prof }, { data: house }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    supabase.from("houses").select("name").eq("id", houseId).maybeSingle(),
  ]);
  const sender = (prof?.name as string | undefined)?.trim() || "A housemate";
  const houseName = (house?.name as string | undefined)?.trim() || "your house";
  const preview = (typeof body.preview === "string" ? body.preview.trim() : "").slice(0, 140) || "New message";

  await sendPushToUsers(others, {
    title: `${sender} · ${houseName}`,
    body: preview,
    url: "/chat",
    tag: `chat-${houseId}`,
  });
  return NextResponse.json({ ok: true });
}
