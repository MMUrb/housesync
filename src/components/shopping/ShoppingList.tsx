"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { IconCheck } from "@/components/icons";
import type { MemberWithProfile, ShoppingItem } from "@/lib/types";

const NAME_MAX = 80;
const QTY_MAX = 24;

// Unchecked first in the order they were added (stable list you build up), then
// bought items with the most recently ticked at the top. Mirrors the server
// order closely enough that optimistic edits keep a sensible position until the
// next refresh reconciles them.
function sortItems(list: ShoppingItem[]): ShoppingItem[] {
  return [...list].sort((a, b) => {
    if (a.checked !== b.checked) return a.checked ? 1 : -1;
    if (a.checked) {
      const at = a.checked_at ?? a.created_at;
      const bt = b.checked_at ?? b.created_at;
      return at < bt ? 1 : -1;
    }
    return a.created_at < b.created_at ? -1 : 1;
  });
}

export function ShoppingList({
  houseId,
  currentUserId,
  initialItems,
  members,
}: {
  houseId: string;
  currentUserId: string;
  initialItems: ShoppingItem[];
  members: MemberWithProfile[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [items, setItems] = useState<ShoppingItem[]>(() => sortItems(initialItems));
  // Server is the source of truth: re-sync when a fresh snapshot arrives (our own
  // router.refresh(), or a housemate's live change via HouseRealtime).
  useEffect(() => {
    setItems(sortItems(initialItems));
  }, [initialItems]);

  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (userId: string | null) =>
    (userId && members.find((m) => m.user_id === userId)?.profile?.name) || "A housemate";

  const toBuy = items.filter((i) => !i.checked);
  const got = items.filter((i) => i.checked);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: insErr } = await supabase
        .from("shopping_items")
        .insert({
          house_id: houseId,
          name: n.slice(0, NAME_MAX),
          quantity: qty.trim().slice(0, QTY_MAX) || null,
          added_by: currentUserId,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      if (data) setItems((prev) => sortItems([...prev, data as ShoppingItem]));
      // Best-effort house timeline entry, same as other actions.
      void supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "shopping_added",
        message: `added “${n.slice(0, 60)}” to the shopping list`,
      });
      setName("");
      setQty("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that item.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: ShoppingItem) {
    const next = !item.checked;
    const patch = {
      checked: next,
      checked_by: next ? currentUserId : null,
      checked_at: next ? new Date().toISOString() : null,
    };
    setItems((prev) => sortItems(prev.map((x) => (x.id === item.id ? { ...x, ...patch } : x))));
    const { error: upErr } = await supabase
      .from("shopping_items")
      .update(patch)
      .eq("id", item.id);
    if (upErr) {
      // Roll back to the previous state on failure.
      setItems((prev) => sortItems(prev.map((x) => (x.id === item.id ? item : x))));
    } else {
      router.refresh();
    }
  }

  async function remove(item: ShoppingItem) {
    const prev = items;
    setItems((list) => list.filter((x) => x.id !== item.id));
    const { error: delErr } = await supabase.from("shopping_items").delete().eq("id", item.id);
    if (delErr) setItems(prev); // restore on failure
    else router.refresh();
  }

  async function clearGot() {
    if (got.length === 0) return;
    const prev = items;
    setItems((list) => list.filter((x) => !x.checked));
    const { error: delErr } = await supabase
      .from("shopping_items")
      .delete()
      .eq("house_id", houseId)
      .eq("checked", true);
    if (delErr) setItems(prev);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addItem} className="card flex items-center gap-2 p-3">
        <input
          className="input flex-1"
          placeholder="Add an item (e.g. Milk)"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          aria-label="Item name"
        />
        <input
          className="input w-20 shrink-0"
          placeholder="Qty"
          value={qty}
          maxLength={QTY_MAX}
          onChange={(e) => setQty(e.target.value)}
          aria-label="Quantity (optional)"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="btn-primary shrink-0 px-4 py-2 text-sm"
        >
          Add
        </button>
      </form>

      {error && <p className="px-1 text-xs text-red-600">{error}</p>}

      {items.length === 0 ? (
        <div className="card flex flex-col items-center p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-mint-100 text-3xl">🛒</div>
          <h2 className="mt-3 font-semibold text-slate-900">Nothing on the list</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Add what the house needs. Everyone sees it update live, and can tick things off at the
            shop.
          </p>
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="px-1 text-sm font-semibold text-slate-900">
              To buy {toBuy.length > 0 && <span className="text-slate-400">({toBuy.length})</span>}
            </h2>
            {toBuy.length === 0 ? (
              <div className="card p-4 text-sm text-slate-500">All done. Nice one. 🎉</div>
            ) : (
              <ul className="card divide-y divide-slate-100">
                {toBuy.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    caption={`Added by ${nameOf(item.added_by)}`}
                    onToggle={() => toggle(item)}
                    onRemove={() => remove(item)}
                  />
                ))}
              </ul>
            )}
          </section>

          {got.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-slate-900">
                  Got it <span className="text-slate-400">({got.length})</span>
                </h2>
                <button
                  type="button"
                  onClick={clearGot}
                  className="text-xs font-medium text-slate-400 transition-colors hover:text-red-600"
                >
                  Clear got
                </button>
              </div>
              <ul className="card divide-y divide-slate-100">
                {got.map((item) => (
                  <Row
                    key={item.id}
                    item={item}
                    caption={`Got by ${nameOf(item.checked_by)}`}
                    onToggle={() => toggle(item)}
                    onRemove={() => remove(item)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Row({
  item,
  caption,
  onToggle,
  onRemove,
}: {
  item: ShoppingItem;
  caption: string;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-3 p-3.5">
      <button
        onClick={onToggle}
        aria-label={item.checked ? "Move back to buy" : "Mark as bought"}
        aria-pressed={item.checked}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition ${
          item.checked
            ? "border-mint-500 bg-mint-100 text-mint-600"
            : "border-slate-300 text-transparent hover:border-mint-500 hover:text-mint-500"
        }`}
      >
        <IconCheck className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`flex items-center gap-2 text-sm font-medium ${
            item.checked ? "text-slate-400 line-through" : "text-slate-900"
          }`}
        >
          <span className="min-w-0 break-words">{item.name}</span>
          {item.quantity && (
            <span className="chip shrink-0 bg-slate-100 text-slate-500">{item.quantity}</span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{caption}</p>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.name}`}
        className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        Remove
      </button>
    </li>
  );
}
