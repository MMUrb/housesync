// Generates the social share image (public/og.png, 1200x630) from the brand.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });

const glyph = `
  <path d="M256 120 L392 232 V392 a16 16 0 0 1 -16 16 H136 a16 16 0 0 1 -16 -16 V232 Z"
        fill="none" stroke="#6f53f5" stroke-width="28" stroke-linejoin="round"/>
  <path d="M212 300 a44 44 0 1 1 13 53" fill="none" stroke="#6f53f5" stroke-width="24" stroke-linecap="round"/>
  <path d="M214 268 v34 h34" fill="none" stroke="#6f53f5" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7b5cff"/><stop offset="1" stop-color="#5a32d4"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1060" cy="110" r="240" fill="#ffffff" opacity="0.06"/>
  <circle cx="1150" cy="585" r="180" fill="#ffffff" opacity="0.05"/>
  <rect x="90" y="84" width="104" height="104" rx="26" fill="#ffffff"/>
  <g transform="translate(99,93) scale(0.1685)">${glyph}</g>
  <text x="222" y="155" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="bold" fill="#ffffff">HouseSync</text>
  <text x="88" y="322" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="bold" fill="#ffffff">Stop arguing about</text>
  <text x="88" y="416" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="bold" fill="#ffffff">house bills.</text>
  <text x="90" y="486" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#ffffff" opacity="0.92">Split rent, bills, groceries &amp; chores with your housemates.</text>
  <text x="90" y="560" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="bold" fill="#ffffff" opacity="0.9">housesync.co.uk</text>
</svg>`;

await sharp(Buffer.from(svg), { density: 220 }).png().toFile("public/og.png");
console.log("wrote public/og.png");
