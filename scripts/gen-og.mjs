// Generates the social share image (public/og.png, 1200x630) from the brand.
import sharp from "sharp";
import { mkdirSync, readFileSync } from "node:fs";

mkdirSync("public", { recursive: true });

// Purple version of the brand glyph for the white tile: take the white glyph
// matte (assets/glyph-source.png) and tint it brand purple.
const GW = 524, GH = 594, PURPLE = "#5f43e6";
const purpleGlyph = await sharp({
  create: { width: GW, height: GH, channels: 4, background: PURPLE },
})
  .composite([{ input: "assets/glyph-source.png", blend: "dest-in" }])
  .png()
  .toBuffer();
const B = purpleGlyph.toString("base64");

// white tile + centred purple glyph
const tile = 104, tx = 90, ty = 84;
const gh = tile * 0.62, gw = gh * (GW / GH), gx = tx + (tile - gw) / 2, gy = ty + (tile - gh) / 2;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6d57ec"/><stop offset="1" stop-color="#46329a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1060" cy="110" r="240" fill="#ffffff" opacity="0.06"/>
  <circle cx="1150" cy="585" r="180" fill="#ffffff" opacity="0.05"/>
  <rect x="${tx}" y="${ty}" width="${tile}" height="${tile}" rx="26" fill="#ffffff"/>
  <image x="${gx.toFixed(1)}" y="${gy.toFixed(1)}" width="${gw.toFixed(1)}" height="${gh.toFixed(1)}" href="data:image/png;base64,${B}"/>
  <text x="222" y="155" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="bold" fill="#ffffff">HouseSync</text>
  <text x="88" y="322" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="bold" fill="#ffffff">Stop arguing about</text>
  <text x="88" y="416" font-family="Arial, Helvetica, sans-serif" font-size="84" font-weight="bold" fill="#ffffff">house bills.</text>
  <text x="90" y="486" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#ffffff" opacity="0.92">Split rent, bills, groceries &amp; chores with your housemates.</text>
  <text x="90" y="560" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="bold" fill="#ffffff" opacity="0.9">housesync.co.uk</text>
</svg>`;

await sharp(Buffer.from(svg), { density: 220 }).png().toFile("public/og.png");
console.log("wrote public/og.png");
