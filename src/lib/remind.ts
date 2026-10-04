import { firstName } from "@/lib/format";

// The Remind button, on every device: a HouseSync notification to the
// housemate (api/push/remind), not a message to pass on.

export type RemindResult = "sent" | "nothing_owed" | "notifications_off" | "too_soon" | "error";

export async function remindHousemate(houseId: string, toUserId: string): Promise<RemindResult> {
  try {
    const res = await fetch("/api/push/remind", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ houseId, toUserId }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
    if (res.ok && data.ok) return "sent";
    const r = data.reason;
    return r === "nothing_owed" || r === "notifications_off" || r === "too_soon" ? r : "error";
  } catch {
    return "error";
  }
}

/** What the sender sees after tapping Remind. */
export function remindToast(result: RemindResult, name: string): string {
  const who = firstName(name);
  switch (result) {
    case "sent":
      return `Reminder sent to ${who}`;
    case "too_soon":
      return `You've already reminded ${who} today`;
    case "notifications_off":
      return `Not sent: ${who} has notifications off`;
    case "nothing_owed":
      return `${who} doesn't owe you anything right now`;
    default:
      return "Couldn't send that. Try again.";
  }
}
