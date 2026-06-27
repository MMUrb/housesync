// Generates the Google Play feature graphic (1024x500) from the brand icon.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const B = readFileSync('assets/glyph-source.png').toString('base64');
const GW = 524, GH = 594;
const TL = '#6f5cf0', BR = '#4b36de';

// app-icon tile on the right (lighter so it pops off the darker banner bg)
const tile = 320, tx = 1024 - 80 - tile, ty = (500 - tile) / 2, rx = tile * 0.22;
const gh = tile * 0.615, gw = gh * (GW / GH), gx = tx + (tile - gw) / 2, gy = ty + (tile - gh) / 2;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6d57ec"/><stop offset="1" stop-color="#46329a"/>
    </linearGradient>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8f7bff"/><stop offset="1" stop-color="${BR}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <circle cx="930" cy="60" r="220" fill="#ffffff" opacity="0.05"/>
  <circle cx="120" cy="470" r="180" fill="#ffffff" opacity="0.04"/>
  <rect x="${tx}" y="${ty}" width="${tile}" height="${tile}" rx="${rx.toFixed(0)}" fill="url(#tile)"/>
  <image x="${gx.toFixed(1)}" y="${gy.toFixed(1)}" width="${gw.toFixed(1)}" height="${gh.toFixed(1)}" href="data:image/png;base64,${B}"/>
  <text x="86" y="225" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="bold" fill="#ffffff">HouseSync</text>
  <text x="90" y="300" font-family="Arial, Helvetica, sans-serif" font-size="40" fill="#ffffff" opacity="0.94">Split rent, bills &amp; chores</text>
  <text x="90" y="352" font-family="Arial, Helvetica, sans-serif" font-size="40" fill="#ffffff" opacity="0.94">with your housemates</text>
</svg>`;

await sharp(Buffer.from(svg), { density: 220 }).resize(1024, 500).png()
  .toFile('play-store-assets/feature-graphic-1024x500.png');
console.log('wrote play-store-assets/feature-graphic-1024x500.png');
