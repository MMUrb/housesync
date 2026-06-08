// Downloads 10 cartoon avatar SVGs (DiceBear avataaars v9) into public/avatars.
// 5 female (1-5), 5 male (6-10). Each has its OWN friendly expression (so they
// differ), except F2 (preset-2) and M2 (preset-7) which share one. Clothing is
// forced to dark hex colours so it always contrasts the pale backgrounds.
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("public/avatars", { recursive: true });

const bg = "b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c1f4cd";
const CLOTHES = ["263238", "4a148c", "b71c1c", "1b5e20", "0d47a1", "e65100"];
const BROWN = "d08b5b"; // light-brown skin
const BLACK = "2c1b18"; // black hair / facial hair
// Shared expression for F2 + M2 (calm, gentle smile)
const SHARED = { eyes: "default", eyebrows: "defaultNatural", mouth: "twinkle" };

const presets = [
  // Female (1-5)
  { seed: "Hannah", top: "straight02", eyes: "happy", eyebrows: "default", mouth: "smile" },
  // F2: light-brown skin, black straight hair, big square GREEN glasses
  { seed: "Priya", top: "straight01", hairColor: BLACK, skinColor: BROWN, accessories: "prescription02", accessoriesColor: "27ae60", ...SHARED },
  { seed: "Sophie", top: "curly", eyes: "wink", eyebrows: "default", mouth: "smile" },
  { seed: "Chloe", top: "bun", eyes: "happy", eyebrows: "defaultNatural", mouth: "default" },
  { seed: "Emily", top: "bigHair", eyes: "default", eyebrows: "default", mouth: "smile" },
  // Male (6-10)
  { seed: "James", top: "shortFlat", eyes: "squint", eyebrows: "defaultNatural", mouth: "smile" },
  // M2: light-brown skin, black LONGER curly hair, moustache only (no beard)
  { seed: "Diego", top: "curly", hairColor: BLACK, skinColor: BROWN, facialHair: "moustacheFancy", facialHairColor: BLACK, ...SHARED },
  { seed: "Oliver", top: "theCaesar", eyes: "happy", eyebrows: "default", mouth: "twinkle" },
  { seed: "Ryan", top: "sides", facialHair: "beardMedium", eyes: "wink", eyebrows: "defaultNatural", mouth: "default" },
  { seed: "Adam", top: "shortRound", eyes: "happy", eyebrows: "raisedExcited", mouth: "smile" },
];

let ok = 0;
for (let i = 0; i < presets.length; i++) {
  const p = presets[i];
  const params = new URLSearchParams();
  params.set("seed", p.seed);
  params.set("top", p.top);
  params.set("radius", "50");
  params.set("backgroundColor", bg);
  params.set("eyes", p.eyes);
  params.set("eyebrows", p.eyebrows);
  params.set("mouth", p.mouth);
  params.set("accessoriesProbability", p.accessories ? "100" : "0");
  if (p.accessories) params.set("accessories", p.accessories);
  if (p.accessoriesColor) params.set("accessoriesColor", p.accessoriesColor);
  params.set("facialHairProbability", p.facialHair ? "100" : "0");
  if (p.facialHair) params.set("facialHair", p.facialHair);
  if (p.facialHairColor) params.set("facialHairColor", p.facialHairColor);
  if (p.skinColor) params.set("skinColor", p.skinColor);
  if (p.hairColor) params.set("hairColor", p.hairColor);
  for (const c of CLOTHES) params.append("clothesColor", c);

  const url = `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`;
  try {
    const res = await fetch(url);
    const svg = await res.text();
    if (!svg.includes("<svg")) throw new Error(`${res.status}: ${svg.slice(0, 120)}`);
    writeFileSync(`public/avatars/preset-${i + 1}.svg`, svg);
    ok++;
  } catch (e) {
    console.log(`preset-${i + 1} FAILED:`, e.message);
  }
}
console.log(`saved ${ok}/${presets.length} preset avatars`);
