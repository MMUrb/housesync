import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Downloadable transcript of one house's ENTIRE chat, WhatsApp-export style:
// "[31/07/2026, 14:05] Rahul: message". Every member can already read the
// whole conversation in-app, so this exports nothing they can't see. RLS
// scopes the queries to houses the caller belongs to, so another house's id
// returns nothing rather than leaking data.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const houseId = new URL(request.url).searchParams.get("house");
  if (!houseId) return NextResponse.json({ error: "Missing house." }, { status: 400 });

  const { data: house } = await supabase
    .from("houses")
    .select("id, name")
    .eq("id", houseId)
    .maybeSingle();
  if (!house) return NextResponse.json({ error: "House not found." }, { status: 404 });

  // Names for the transcript. Departed members won't resolve — label them.
  const { data: members } = await supabase
    .from("house_members")
    .select("user_id")
    .eq("house_id", houseId);
  const memberIds = (members ?? []).map((m) => m.user_id as string);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, name").in("id", memberIds)
    : { data: [] as { id: string; name: string | null }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name || "Housemate"]));

  // The whole history, oldest first, paged past PostgREST's per-request cap.
  type Row = { id: string; user_id: string; body: string; created_at: string; reply_to: string | null };
  const all: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("messages")
      .select("id, user_id, body, created_at, reply_to")
      .eq("house_id", houseId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: "Could not load messages." }, { status: 500 });
    all.push(...((data as Row[] | null) ?? []));
    if (!data || data.length < PAGE) break;
  }

  const stamp = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Europe/London",
    });
    const time = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    });
    return `${date}, ${time}`;
  };

  const nameOf = (id: string) => nameById.get(id) ?? "Former housemate";
  const lines = all.map((m) => {
    const reply = m.reply_to ? "↩ " : "";
    return `[${stamp(m.created_at)}] ${nameOf(m.user_id)}: ${reply}${m.body}`;
  });

  const exportedAt = stamp(new Date().toISOString());
  const text =
    `${house.name} — HouseSync chat history\n` +
    `Exported ${exportedAt} · ${all.length} message${all.length === 1 ? "" : "s"}\n\n` +
    lines.join("\n") +
    "\n";

  const slug =
    String(house.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "house";
  const day = new Date().toISOString().slice(0, 10);

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="housesync-${slug}-chat-${day}.txt"`,
      "Cache-Control": "no-store",
    },
  });
}
