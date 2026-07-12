// Generates PNG source assets for @capacitor/assets from the HouseSync logo.
// Outputs into ./assets which `npx capacitor-assets generate` then consumes.
// The artwork is the brand icon: white house + undo arrow glyph on a purple
// gradient. The glyph is the exact artwork in assets/glyph-source.png (white on
// transparent); the gradient below matches the brand icon.
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';

mkdirSync('assets', { recursive: true });

// Brand gradient (sampled from the icon: top-left light -> bottom-right deep).
const TL = '#6f5cf0', BR = '#4b36de';
const GRAD = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${TL}"/><stop offset="1" stop-color="${BR}"/>
</linearGradient></defs>`;

// White glyph (house + undo arrow), exact artwork, white-on-transparent PNG.
const GLYPH_B64 = readFileSync('assets/glyph-source.png').toString('base64');
const GW = 524, GH = 594; // native trimmed size of the glyph

// Places the glyph centred on a `size` canvas at `hFrac` of the canvas height.
const glyph = (size, hFrac) => {
  const gh = size * hFrac, gw = gh * (GW / GH);
  const gx = (size - gw) / 2, gy = (size - gh) / 2;
  return `<image x="${gx.toFixed(1)}" y="${gy.toFixed(1)}" width="${gw.toFixed(1)}" height="${gh.toFixed(1)}" href="data:image/png;base64,${GLYPH_B64}"/>`;
};

const SVG = (inner, size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`;

// Full-bleed square icon (NO rounding — iOS/Android mask the corners themselves).
// Kept square so a re-run matches the deployed full-bleed App Store icon instead
// of regressing it back to a pre-rounded shape.
const iconOnly = SVG(`${GRAD}<rect width="1024" height="1024" fill="url(#g)"/>${glyph(1024, 0.615)}`);

// Adaptive background: full-bleed gradient (Android applies its own mask).
const iconBg = SVG(`${GRAD}<rect width="1024" height="1024" fill="url(#g)"/>`);

// Adaptive foreground: transparent, glyph sized to sit inside the safe zone.
const iconFg = SVG(glyph(1024, 0.46));

// Splash: full image = background + centered icon (~26%).
const splash = (bg) => {
  const S = 2732, icon = S * 0.26, ix = (S - icon) / 2, iy = (S - icon) / 2, rx = icon * 0.219;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    ${GRAD}<rect width="${S}" height="${S}" fill="${bg}"/>
    <svg x="${ix.toFixed(0)}" y="${iy.toFixed(0)}" width="${icon.toFixed(0)}" height="${icon.toFixed(0)}" viewBox="0 0 1024 1024">
      <rect width="1024" height="1024" rx="${rx.toFixed(0)}" fill="url(#g)"/>${glyph(1024, 0.615)}
    </svg></svg>`;
};

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
