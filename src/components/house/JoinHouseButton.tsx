"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setActiveHouse } from "@/lib/activeHouse";
import type { House } from "@/lib/types";

export function JoinHouseButton({ code }: { code: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("join_house", { p_invite_code: code });
      if (error) throw error;
      const house = (Array.isArray(data) ? data[0] : data) as House;
      if (house?.id) setActiveHouse(house.id);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this house.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={join} disabled={loading} className="btn-primary btn-block">
        {loading ? "Joining…" : "Join this house"}
      </button>
      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
