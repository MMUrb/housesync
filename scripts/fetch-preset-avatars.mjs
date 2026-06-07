// Downloads 10 cartoon avatar SVGs (DiceBear avataaars) into public/avatars:
// 5 female (presets 1-5, long hair, no facial hair) and 5 male (presets 6-10,
// short hair, a couple with beards). Self-hosted so there's no runtime dep.
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("public/avatars", { recursive: true });
const bg = "b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c1f4cd";

const presets = [
  // Female — long hairstyles, no facial hair
  { seed: "Bella", top: "straight02" },
  { seed: "Nova", top: "bob" },
  { seed: "Ruby", top: "curly" },
  { seed: "Ivy", top: "bun" },
  { seed: "Zoe", top: "bigHair" },
  // Male — short hairstyles, a couple with beards
  { seed: "Milo", top: "shortFlat" },
  { seed: "Leo", top: "shortWaved", facialHair: "beardLight" },
  { seed: "Finn", top: "theCaesar" },
  { seed: "Max", top: "sides", facialHair: "beardMedium" },
  { seed: "Theo", top: "shortRound" },
];

let ok = 0;
for (let i = 0; i < presets.length; i++) {
  const p = presets[i];
  const params = new URLSearchParams({
    seed: p.seed,
    top: p.top,
    radius: "50",
    backgroundColor: bg,
    accessoriesProbability: "0",
    facialHairProbability: p.facialHair ? "100" : "0",
  });
  if (p.facialHair) params.set("facialHair", p.facialHair);
  const url = `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`;
  try {
    const svg = await fetch(url).then((r) => r.text());
    if (!svg.includes("<svg")) throw new Error("not an svg");
    writeFileSync(`public/avatars/preset-${i + 1}.svg`, svg);
    ok++;
  } catch (e) {
    console.log(`preset-${i + 1} FAILED:`, e.message);
  }
}
console.log(`saved ${ok}/${presets.length} preset avatars (1-5 female, 6-10 male)`);
