import "server-only";

// Daily foreign-exchange rates, used only to show an approximate *second* amount
// in a person's own currency next to the house's real totals. Source is
// open.er-api.com (free, no key, ~160 currencies, refreshed once a day). Cached
// in Next's Data Cache for 12h so we hit the upstream at most a couple of times
// a day no matter the traffic, and never block the render for long.

type ErApiResponse = { result?: string; rates?: Record<string, number> };

async function fetchRates(base: string): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
      next: { revalidate: 43_200 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ErApiResponse;
    if (data.result !== "success" || !data.rates) return null;
    return data.rates;
  } catch {
    return null;
  }
}

// Rate to convert 1 unit of `from` into `to`. Returns null when the pair can't
// be resolved (network down, unknown code) so callers simply fall back to
// showing the base amount on its own.
export async function getRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  if (!from || !to) return null;
  const rates = await fetchRates(from);
  const rate = rates?.[to];
  return typeof rate === "number" && rate > 0 ? rate : null;
}
