// Generates a scrypt hash for the admin password gate.
// Run locally (the password never leaves your machine):
//   node scripts/hash-admin-password.mjs "your-strong-password"
// Then paste the printed value into the ADMIN_PASSWORD_HASH env var in Vercel.
import { scryptSync, randomBytes } from "node:crypto";

const pw = process.argv[2];
if (!pw || pw.length < 8) {
  console.error("Usage: node scripts/hash-admin-password.mjs <password (min 8 chars)>");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(pw, salt, 64).toString("hex");
console.log("\nADMIN_PASSWORD_HASH=" + `${salt}:${hash}` + "\n");
console.log("Paste the line above into your Vercel environment variables, then redeploy.");
console.log("Tip: clear your shell history afterwards so the password isn't saved.");
