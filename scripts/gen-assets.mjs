// Generates PNG source assets for @capacitor/assets from the HouseSync SVG logo.
// Outputs into ./assets which `npx capacitor-assets generate` then consumes.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('assets', { recursive: true });

const GRAD = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#8f7bff"/><stop offset="1" stop-color="#5f3fe0"/>
</linearGradient></defs>`;

// The white house + sync glyph (from public/icon.svg).
const GLYPH = `
  <path d="M256 120 L392 232 V392 a16 16 0 0 1 -16 16 H136 a16 16 0 0 1 -16 -16 V232 Z"
        fill="none" stroke="#ffffff" stroke-width="26" stroke-linejoin="round"/>
  <path d="M212 300 a44 44 0 1 1 13 53" fill="none" stroke="#ffffff" stroke-width="22"
        stroke-linecap="round"/>
  <path d="M214 268 v34 h34" fill="none" stroke="#ffffff" stroke-width="22"
        stroke-linecap="round" stroke-linejoin="round"/>`;

// Full square icon (rounded) — used for iOS/legacy + as the icon-only source.
const iconOnly = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${GRAD}<rect width="512" height="512" rx="112" fill="url(#g)"/>${GLYPH}</svg>`;

// Adaptive background: full-bleed gradient (Android applies its own mask).
const iconBg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${GRAD}<rect width="512" height="512" fill="url(#g)"/></svg>`;

// Adaptive foreground: transparent, white glyph scaled to 0.8 inside the safe zone.
const iconFg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <g transform="translate(256,256) scale(0.8) translate(-256,-256)">${GLYPH}</g></svg>`;

// Splash: full image = background + centered icon (~30%).
const splash = (bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
  ${GRAD}<rect width="2732" height="2732" fill="${bg}"/>
  <g transform="translate(956,956) scale(1.6)">
    <rect width="512" height="512" rx="112" fill="url(#g)"/>${GLYPH}</g></svg>`;

const jobs = [
  ['assets/icon-only.png', iconOnly, 1024],
  ['assets/icon-background.png', iconBg, 1024],
  ['assets/icon-foreground.png', iconFg, 1024],
  ['assets/splash.png', splash('#f6f7fb'), 2732],
  ['assets/splash-dark.png', splash('#0f0b1e'), 2732],
];

for (const [out, svg, size] of jobs) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(out);
  console.log('wrote', out);
}
console.log('done');
