// Downloads 10 cartoon avatar SVGs (DiceBear avataaars) into public/avatars:
// 5 female (1-5, long hair) and 5 male (6-10, short hair, two bearded).
// Expressions are constrained to calm/friendly so they look normal, not goofy.
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("public/avatars", { recursive: true });
const bg = "b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c1f4cd";

// Only pleasant, natural expressions (no tongues, screaming, surprised eyes…).
const NORMAL = {
  eyes: ["default", "happy"],
  eyebrows: ["default", "defaultNatural"],
  mouth: ["smile", "default"],
};

const presets = [
  // Female — long hairstyles, no facial hair
  { seed: "Hannah", top: "straight02" },
  { seed: "Grace", top: "bob" },
  { seed: "Sophie", top: "curly" },
  { seed: "Chloe", top: "bun" },
  { seed: "Emily", top: "bigHair" },
  // Male — short hairstyles, a couple with beards
  { seed: "James", top: "shortFlat" },
  { seed: "Daniel", top: "shortWaved", facialHair: "beardLight" },
  { seed: "Oliver", top: "theCaesar" },
  { seed: "Ryan", top: "sides", facialHair: "beardMedium" },
  { seed: "Adam", top: "shortRound" },
];

let ok = 0;
for (let i = 0; i < presets.length; i++) {
  const p = presets[i];
  const params = new URLSearchParams();
  params.set("seed", p.seed);
  params.set("top", p.top);
  params.set("radius", "50");
  params.set("backgroundColor", bg);
  params.set("accessoriesProbability", "0");
  params.set("facialHairProbability", p.facialHair ? "100" : "0");
  if (p.facialHair) params.set("facialHair", p.facialHair);
  for (const [key, vals] of Object.entries(NORMAL)) for (const v of vals) params.append(key, v);

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
console.log(`saved ${ok}/${presets.length} preset avatars (calm expressions, 1-5 F / 6-10 M)`);
