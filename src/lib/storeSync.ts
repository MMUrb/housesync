import "server-only";
import { createSign, sign as cryptoSign, createHash } from "crypto";
import { gunzipSync } from "zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCsv } from "@/lib/csv";

// Pulls download numbers from both app stores into the store_daily table.
// No SDKs: both APIs are called with hand-rolled JWTs over fetch, because the
// official clients would add megabytes of dependency for two endpoints.
//
// Google Play: install counts are NOT in the Play Developer API. They arrive
// as CSV files in a Cloud Storage bucket (Play Console > Download reports),
// read here with a service account. Daily rows, bucketed in Pacific time,
// lagging one to two days.
//
// App Store: the Sales Reports API (gzipped TSV, one file per day). "Units"
// with a product type starting 1/F1 are first-time downloads; 7/F7 are updates.

const APP_PACKAGE = "uk.co.housesync";

export type DailyRow = {
  day: string; // YYYY-MM-DD
  downloads: number | null;
  updates: number | null;
  uninstalls: number | null;
};

/* ------------------------------ Google Play ------------------------------ */

type ServiceAccount = { client_email: string; private_key: string };

export function playConfig(): { bucket: string; sa: ServiceAccount } | null {
  const bucket = (process.env.PLAY_REPORTS_BUCKET ?? "").trim().replace(/^gs:\/\//, "").split("/")[0];
  const raw = process.env.PLAY_REPORTS_KEY ?? "";
  if (!bucket || !raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) return null;
    return { bucket, sa };
  } catch {
    return null;
  }
}

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** OAuth token for the storage read scope, via a signed service-account JWT. */
async function playAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/devstorage.read_only",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { access_token: string };
  return j.access_token;
}

/** Play's stats CSVs are UTF-16LE with a BOM; older ones are plain UTF-8. */
function decodeCsv(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le");
  return buf.toString("utf8");
}

/**
 * Daily install/uninstall rows for every month that overlaps [sinceDay, today].
 * Reads stats/installs/installs_<pkg>_<YYYYMM>_overview.csv from the bucket.
 */
export async function fetchPlayDaily(sinceDay: string): Promise<DailyRow[]> {
  const cfg = playConfig();
  if (!cfg) throw new Error("Play reports not configured");
  const token = await playAccessToken(cfg.sa);

  const months: string[] = [];
  const start = new Date(`${sinceDay}T00:00:00Z`);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const now = new Date();
  while (cursor <= now) {
    months.push(
      `${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
    );
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const rows: DailyRow[] = [];
  for (const month of months) {
    const object = `stats/installs/installs_${APP_PACKAGE}_${month}_overview.csv`;
    const url = `https://storage.googleapis.com/storage/v1/b/${cfg.bucket}/o/${encodeURIComponent(object)}?alt=media`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 404) continue; // month with no report yet
    if (!res.ok) throw new Error(`Play CSV ${month}: ${res.status} ${await res.text()}`);

    const text = decodeCsv(Buffer.from(await res.arrayBuffer()));
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) continue;
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const iDate = headers.indexOf("date");
    const iInst = headers.findIndex((h) => h === "daily device installs");
    const iUnin = headers.findIndex((h) => h === "daily device uninstalls");
    if (iDate < 0) continue;

    for (const line of lines.slice(1)) {
      const cols = line.split(",");
      const day = (cols[iDate] ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < sinceDay) continue;
      rows.push({
        day,
        downloads: iInst >= 0 ? Number(cols[iInst]) || 0 : null,
        updates: null,
        uninstalls: iUnin >= 0 ? Number(cols[iUnin]) || 0 : null,
      });
    }
  }
  return rows;
}

/* ------------------------------- App Store ------------------------------- */

export function ascConfig(): {
  issuerId: string;
  keyId: string;
  privateKey: string;
  vendor: string;
} | null {
  const issuerId = (process.env.ASC_ISSUER_ID ?? "").trim();
  const keyId = (process.env.ASC_KEY_ID ?? "").trim();
  const vendor = (process.env.ASC_VENDOR_NUMBER ?? "").trim();
  // Vercel env vars flatten newlines to "\n" literals; restore them.
  const privateKey = (process.env.ASC_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
  if (!issuerId || !keyId || !vendor || !privateKey) return null;
  return { issuerId, keyId, privateKey, vendor };
}

/** Short-lived ES256 JWT for the App Store Connect API. */
function ascToken(cfg: NonNullable<ReturnType<typeof ascConfig>>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId, typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: cfg.issuerId, iat: now, exp: now + 10 * 60, aud: "appstoreconnect-v1" }),
  );
  // JOSE wants the raw r||s signature, not DER.
  const sig = cryptoSign("sha256", Buffer.from(`${header}.${claims}`), {
    key: cfg.privateKey,
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${claims}.${b64url(sig)}`;
}

const isNewDownload = (t: string) => t.startsWith("1") || t.startsWith("F1");
const isUpdate = (t: string) => t.startsWith("7") || t.startsWith("F7");

/**
 * One day's iOS downloads/updates from the daily SALES summary report.
 * Returns null when Apple hasn't published that day yet (reports lag ~1 day).
 */
export async function fetchAscDay(day: string): Promise<DailyRow | null> {
  const cfg = ascConfig();
  if (!cfg) throw new Error("App Store Connect not configured");

  const qs = new URLSearchParams({
    "filter[frequency]": "DAILY",
    "filter[reportDate]": day,
    "filter[reportType]": "SALES",
    "filter[reportSubType]": "SUMMARY",
    "filter[vendorNumber]": cfg.vendor,
  });
  const res = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${qs}`, {
    headers: { authorization: `Bearer ${ascToken(cfg)}`, accept: "application/a-gzip" },
  });
  if (res.status === 404) return null; // not published yet, or a zero-activity day
  if (!res.ok) throw new Error(`ASC ${day}: ${res.status} ${await res.text()}`);

  const tsv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
  const lines = tsv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { day, downloads: 0, updates: 0, uninstalls: null };

  const headers = lines[0].split("\t").map((h) => h.trim().toLowerCase());
  const iUnits = headers.indexOf("units");
  const iType = headers.indexOf("product type identifier");

  let downloads = 0;
  let updates = 0;
  // The report covers the whole vendor, but HouseSync is the vendor's only
  // app, so every row is ours. Revisit if a second app ever ships.
  for (const line of lines.slice(1)) {
    const cols = line.split("\t");
    const units = Number(cols[iUnits]) || 0;
    const type = (cols[iType] ?? "").trim();
    if (isNewDownload(type)) downloads += units;
    else if (isUpdate(type)) updates += units;
  }
  return { day, downloads, updates, uninstalls: null };
}

/* -------------------------------- Reviews -------------------------------- */

// Numeric App Store id for uk.co.housesync, resolved once via GET /v1/apps.
const ASC_APP_ID = "6783905558";

// Reviews reach back before launch (the closed-testing period), so their
// window is fixed rather than tied to the sync's days parameter.
const REVIEWS_SINCE = "2026-06-01";

export type ReviewRow = {
  id: string;
  platform: "ios" | "android";
  rating: number;
  title: string | null;
  body: string | null;
  author: string | null;
  territory: string | null;
  app_version: string | null;
  reviewed_at: string;
};

/** All written App Store reviews, newest first, via the customerReviews API. */
export async function fetchAscReviews(cap = 400): Promise<ReviewRow[]> {
  const cfg = ascConfig();
  if (!cfg) throw new Error("App Store Connect not configured");

  const out: ReviewRow[] = [];
  let url: string | null =
    `https://api.appstoreconnect.apple.com/v1/apps/${ASC_APP_ID}/customerReviews?limit=200&sort=-createdDate`;
  while (url && out.length < cap) {
    const res = await fetch(url, { headers: { authorization: `Bearer ${ascToken(cfg)}` } });
    if (!res.ok) throw new Error(`ASC reviews: ${res.status} ${await res.text()}`);
    const j = (await res.json()) as {
      data?: { id: string; attributes?: Record<string, unknown> }[];
      links?: { next?: string };
    };
    for (const r of j.data ?? []) {
      const a = r.attributes ?? {};
      const rating = Number(a.rating);
      if (!(rating >= 1 && rating <= 5) || typeof a.createdDate !== "string") continue;
      out.push({
        id: `ios-${r.id}`,
        platform: "ios",
        rating,
        title: typeof a.title === "string" && a.title ? a.title : null,
        body: typeof a.body === "string" && a.body ? a.body : null,
        author: typeof a.reviewerNickname === "string" && a.reviewerNickname ? a.reviewerNickname : null,
        territory: typeof a.territory === "string" && a.territory ? a.territory : null,
        app_version: null, // not exposed by this endpoint
        reviewed_at: a.createdDate,
      });
    }
    url = j.links?.next ?? null;
  }
  return out;
}

/**
 * All written Play reviews from the monthly reviews CSVs in the stats bucket.
 * Play includes no reviewer name in these exports, so author stays null.
 */
export async function fetchPlayReviews(): Promise<ReviewRow[]> {
  const cfg = playConfig();
  if (!cfg) throw new Error("Play reports not configured");
  const token = await playAccessToken(cfg.sa);

  const months: string[] = [];
  const start = new Date(`${REVIEWS_SINCE}T00:00:00Z`);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const now = new Date();
  while (cursor <= now) {
    months.push(`${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const out: ReviewRow[] = [];
  for (const month of months) {
    const object = `reviews/reviews_${APP_PACKAGE}_${month}.csv`;
    const url = `https://storage.googleapis.com/storage/v1/b/${cfg.bucket}/o/${encodeURIComponent(object)}?alt=media`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 404) continue; // month with no reviews
    if (!res.ok) throw new Error(`Play reviews ${month}: ${res.status} ${await res.text()}`);

    const rows = parseCsv(decodeCsv(Buffer.from(await res.arrayBuffer())));
    if (rows.length < 2) continue;
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const col = (name: string) => headers.indexOf(name);
    const iMs = col("review submit millis since epoch");
    const iRating = col("star rating");
    const iTitle = col("review title");
    const iText = col("review text");
    const iLang = col("reviewer language");
    const iVersion = col("app version name");
    if (iMs < 0 || iRating < 0) continue;

    for (const c of rows.slice(1)) {
      const ms = Number(c[iMs]);
      const rating = Number(c[iRating]);
      if (!Number.isFinite(ms) || ms <= 0 || !(rating >= 1 && rating <= 5)) continue;
      const text = (iText >= 0 ? c[iText] : "") ?? "";
      const hash = createHash("sha256").update(text).digest("hex").slice(0, 10);
      out.push({
        id: `and-${ms}-${hash}`,
        platform: "android",
        rating,
        title: iTitle >= 0 && c[iTitle] ? c[iTitle] : null,
        body: text || null,
        author: null,
        territory: iLang >= 0 && c[iLang] ? c[iLang] : null,
        app_version: iVersion >= 0 && c[iVersion] ? c[iVersion] : null,
        reviewed_at: new Date(ms).toISOString(),
      });
    }
  }
  return out;
}

/* ------------------------------- Orchestrator ------------------------------- */

// Launch day: no point asking either store for anything earlier.
export const LAUNCH_DAY = "2026-07-25";

const dayString = (msAgo: number) => new Date(Date.now() - msAgo).toISOString().slice(0, 10);

export type SyncResult = {
  since: string;
  android:
    | { configured: false }
    | { configured: true; upserted?: number; reviews?: number; error?: string };
  ios:
    | {
        configured: false;
      }
    | {
        configured: true;
        upserted?: number;
        notPublishedYet?: number;
        reviews?: number;
        error?: string;
      };
};

async function upsertReviews(admin: SupabaseClient, rows: ReviewRow[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await admin.from("store_reviews").upsert(
    rows.map((r) => ({ ...r, synced_at: new Date().toISOString() })),
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}

/**
 * Pull download numbers from both stores into store_daily for the last
 * `days` days (clamped to launch). Shared by the nightly cron and the
 * admin "Sync now" button; each store fails independently.
 */
export async function runStoreSync(admin: SupabaseClient, daysWanted: number): Promise<SyncResult> {
  const days = Math.min(Math.max(Number.isFinite(daysWanted) ? daysWanted : 5, 1), 400);
  let since = dayString(days * 86_400_000);
  if (since < LAUNCH_DAY) since = LAUNCH_DAY;

  const result: SyncResult = {
    since,
    android: { configured: false },
    ios: { configured: false },
  };

  // Android: monthly CSVs, so one fetch covers the whole window.
  if (playConfig()) {
    const android: Extract<SyncResult["android"], { configured: true }> = { configured: true };
    try {
      const rows = await fetchPlayDaily(since);
      if (rows.length) {
        const { error } = await admin.from("store_daily").upsert(
          rows.map((r) => ({ ...r, platform: "android", synced_at: new Date().toISOString() })),
          { onConflict: "day,platform" },
        );
        if (error) throw new Error(error.message);
      }
      android.upserted = rows.length;
    } catch (e) {
      android.error = e instanceof Error ? e.message : String(e);
    }
    // Reviews fail independently of the daily numbers.
    try {
      const reviews = await fetchPlayReviews();
      await upsertReviews(admin, reviews);
      android.reviews = reviews.length;
    } catch (e) {
      android.error = android.error ?? (e instanceof Error ? e.message : String(e));
    }
    result.android = android;
  }

  // iOS: one report per day. Yesterday's often isn't published yet; that's
  // fine, the next run picks it up.
  if (ascConfig()) {
    const ios: Extract<SyncResult["ios"], { configured: true }> = { configured: true };
    let upserted = 0;
    let missing = 0;
    try {
      for (let i = 1; i <= days; i++) {
        const day = dayString(i * 86_400_000);
        if (day < LAUNCH_DAY) break;
        const row = await fetchAscDay(day);
        if (!row) {
          missing++;
          continue;
        }
        const { error } = await admin
          .from("store_daily")
          .upsert(
            { ...row, platform: "ios", synced_at: new Date().toISOString() },
            { onConflict: "day,platform" },
          );
        if (error) throw new Error(error.message);
        upserted++;
      }
      ios.upserted = upserted;
      ios.notPublishedYet = missing;
    } catch (e) {
      ios.upserted = upserted;
      ios.error = e instanceof Error ? e.message : String(e);
    }
    // Reviews fail independently of the daily numbers.
    try {
      const reviews = await fetchAscReviews();
      await upsertReviews(admin, reviews);
      ios.reviews = reviews.length;
    } catch (e) {
      ios.error = ios.error ?? (e instanceof Error ? e.message : String(e));
    }
    result.ios = ios;
  }

  return result;
}
