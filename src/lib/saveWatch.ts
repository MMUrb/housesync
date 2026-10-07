// Notices saves that fail, so a failure the person saw on screen ("Could not
// save the expense") also reaches the admin Errors tab instead of being known
// only to them. Pure, so it can be tested; lib/supabase/client.ts wires it
// into the shared browser client, which every save in the app goes through.
//
// Only the action and the database's reason are reported, never what the
// person typed: PostgREST's `details` and `hint` can quote row values, so they
// are never read, and every RPC refusal is a fixed code like
// "pay_more_than_owed".

export type SaveWatchEnv = {
  isVisible: () => boolean;
  isOnline: () => boolean;
  /** When the page last went into the background (ms since epoch), or 0. */
  lastHiddenAt: () => number;
  now: () => number;
};

const VERBS: Record<string, string> = {
  POST: "insert",
  PATCH: "update",
  PUT: "upsert",
  DELETE: "delete",
};

/** Storage paths that read rather than save. */
const STORAGE_READS = new Set(["sign", "list", "info", "public", "authenticated"]);

/**
 * Writes the app makes on its own, with nobody waiting on them: the last-seen
 * recorder, chat read receipts, settle-up's sweep and its "all settled" note.
 * They retry by themselves, and they tend to run at the worst moment (the
 * second the app opens, before the phone's connection is ready), so a dropped
 * connection on one is not someone getting stuck. A database refusal on one
 * is still reported, labelled as background.
 *
 * The call site marks the request with .abortSignal(backgroundSignal()). The
 * signal is never aborted; supabase-js hands it to fetch untouched, which is
 * how the mark reaches watchSaves. (Setting db.timeout on the client would
 * swap in a fresh signal and drop the mark, so don't.)
 */
const BACKGROUND_SIGNALS = new WeakSet<AbortSignal>();

export function backgroundSignal(): AbortSignal {
  const signal = new AbortController().signal;
  BACKGROUND_SIGNALS.add(signal);
  return signal;
}

/**
 * What a request saves: "expenses (insert)", "rpc pay_itemised",
 * "storage receipts (upload)". Null when it isn't a save: reads, and all
 * sign-in traffic (a wrong password is the person's mistake, not a failure).
 */
export function describeSave(url: string, method: string): string | null {
  const verb = VERBS[method.toUpperCase()];
  if (!verb) return null;
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const rest = /^\/rest\/v1\/([^/]+)(?:\/([^/]+))?/.exec(path);
  if (rest) {
    if (rest[1] !== "rpc") return `${rest[1]} (${verb})`;
    return rest[2] ? `rpc ${rest[2]}` : null;
  }
  const storage = /^\/storage\/v1\/object\/([^/]+)/.exec(path);
  if (storage && !STORAGE_READS.has(storage[1])) {
    return `storage ${storage[1]} (${verb === "delete" ? "delete" : "upload"})`;
  }
  return null;
}

/**
 * Things a person does that go through our own API routes rather than the
 * database client, so the save watch on that client never sees them fail.
 * Only person-triggered calls belong here; background calls (pushes,
 * analytics, sign-out tidying) stay on plain fetch.
 */
const ACTIONS: Record<string, string> = {
  "/api/account/delete": "deleting their account",
  "/api/email/verify-send": "sending the verify-email link",
  "/api/push/remind": "sending a reminder",
  "/api/push/subscribe": "turning on notifications",
};

/** The action a call to our own API performs, or null when it isn't one we watch. */
export function describeAction(url: string, method: string): string | null {
  if (!VERBS[method.toUpperCase()]) return null;
  let path: string;
  try {
    path = new URL(url, "https://app.invalid").pathname;
  } catch {
    return null;
  }
  return ACTIONS[path] ?? null;
}

function clip(s: string, max = 200): string {
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

/** "42501: new row violates row-level security policy ..." from an error body. */
export function summariseRefusal(body: string): string {
  try {
    const j = JSON.parse(body) as {
      code?: unknown;
      error?: unknown;
      reason?: unknown;
      message?: unknown;
    };
    const code =
      typeof j.code === "string"
        ? j.code
        : typeof j.error === "string"
          ? j.error
          : typeof j.reason === "string"
            ? j.reason
            : "";
    const message = typeof j.message === "string" ? j.message : "";
    const s = [code, message].filter(Boolean).join(": ");
    if (s) return clip(s);
  } catch {
    /* not JSON: fall through */
  }
  return clip(body.trim()) || "no details";
}

/**
 * Wraps fetch so failed saves are reported. The request itself is untouched.
 * kind "save" (the default) watches database writes; kind "action" watches
 * person-triggered calls to our own API routes (describeAction).
 */
export function watchSaves(
  baseFetch: typeof fetch,
  report: (message: string) => void,
  env: SaveWatchEnv,
  opts: { describe?: (url: string, method: string) => string | null; kind?: "save" | "action" } = {},
): typeof fetch {
  const describe = opts.describe ?? describeSave;
  const noun = opts.kind === "action" ? "action" : "save";
  const safeReport = (message: string) => {
    try {
      report(message);
    } catch {
      /* reporting must never break a save */
    }
  };

  return async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method =
      init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
    const what = describe(url, method);
    if (!what) return baseFetch(input, init);
    const background = !!init?.signal && BACKGROUND_SIGNALS.has(init.signal);
    const label = background
      ? `Background ${noun} failed`
      : `${noun === "action" ? "Action" : "Save"} failed`;

    const startedAt = env.now();
    const startedVisible = env.isVisible();
    let res: Response;
    try {
      res = await baseFetch(input, init);
    } catch (e) {
      const name = (e as { name?: unknown } | null)?.name;
      const cancelledOnPurpose = name === "AbortError";
      // iOS freezes a backgrounded app and kills its requests, and the failure
      // only lands once it's reopened (when the page looks visible again), so
      // the page must have stayed in view for the whole request. Offline, the
      // report couldn't be delivered anyway.
      const stayedInView =
        startedVisible && env.isVisible() && env.lastHiddenAt() < startedAt;
      if (!cancelledOnPurpose && !background && stayedInView && env.isOnline()) {
        const why = e instanceof Error ? e.message : String(e);
        safeReport(`${label}: ${what}: connection dropped (${clip(why, 80)})`);
      }
      throw e;
    }

    if (!res.ok) {
      const status = res.status;
      // Read a copy: the caller still gets the untouched original to parse.
      res
        .clone()
        .text()
        .then(
          (body) => {
            const reason = summariseRefusal(body);
            // Already exists: a retry or double tap whose first attempt
            // landed. Nobody is stuck (SimplifySettle relies on exactly this).
            if (status === 409 && reason.startsWith("23505")) return;
            // Our own routes answer 409 and 429 for deliberate no's: nothing
            // owed, notifications off, a reminder or email sent too recently.
            // Those are answers, not failures.
            if (noun === "action" && (status === 409 || status === 429)) return;
            safeReport(`${label}: ${what}: ${status} ${reason}`);
          },
          () => safeReport(`${label}: ${what}: ${status}`),
        );
    }
    return res;
  };
}
