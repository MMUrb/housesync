// Makes a fresh "Sign in with Apple" client secret for Supabase.
//
// The secret Supabase holds (Authentication > Sign In / Providers > Apple >
// "Secret Key (for OAuth)") is a JWT signed with the Apple .p8 key, and Apple
// caps its life at 6 months. When it lapses, Apple login fails with "Unable to
// exchange external code". The current one expires 06/01/2027 (6 January 2027).
//
//   node scripts/apple-client-secret.mjs           prints a new secret to paste
//   node scripts/apple-client-secret.mjs --check   prints only its expiry date
//
// Reads the key from Desktop\AuthKey_YTAP45HH89.p8 (or APPLE_P8=<path>).
// Never paste the .p8 itself anywhere; only the printed secret goes in Supabase.

import { createSign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TEAM_ID = "J557AX5M4U";
const KEY_ID = "YTAP45HH89";
const SERVICES_ID = "uk.co.housesync.web";
const LIFETIME_DAYS = 180; // Apple's maximum is 6 months

const keyPath = process.env.APPLE_P8 ?? join(homedir(), "Desktop", `AuthKey_${KEY_ID}.p8`);
if (!existsSync(keyPath)) {
  console.error(`Can't find the Apple key at ${keyPath}. Set APPLE_P8 to its path.`);
  process.exit(1);
}

const b64url = (input) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const now = Math.floor(Date.now() / 1000);
const exp = now + LIFETIME_DAYS * 24 * 60 * 60;
const header = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
const claims = b64url(
  JSON.stringify({ iss: TEAM_ID, iat: now, exp, aud: "https://appleid.apple.com", sub: SERVICES_ID }),
);
const unsigned = `${header}.${claims}`;
const signature = createSign("sha256")
  .update(unsigned)
  .sign({ key: readFileSync(keyPath, "utf8"), dsaEncoding: "ieee-p1363" });
const secret = `${unsigned}.${b64url(signature)}`;

const expires = new Date(exp * 1000);
const dd = String(expires.getDate()).padStart(2, "0");
const mm = String(expires.getMonth() + 1).padStart(2, "0");
const long = expires.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const when = `${dd}/${mm}/${expires.getFullYear()} (${long})`;

if (process.argv.includes("--check")) {
  console.log(`OK: a secret made now would be valid until ${when}.`);
} else {
  console.log(`New Sign in with Apple secret, valid until ${when}.`);
  console.log("Paste it into Supabase > Authentication > Sign In / Providers > Apple > Secret Key, then Save:\n");
  console.log(secret);
}
