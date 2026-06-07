// Downloads ~10 cartoony avatar SVGs (DiceBear) into public/avatars so they're
// self-hosted (no runtime dependency on the DiceBear API).
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("public/avatars", { recursive: true });

const style = "avataaars";
const seeds = ["Milo", "Bella", "Nova", "Leo", "Ruby", "Finn", "Ivy", "Max", "Zoe", "Theo"];
const bg = "b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,c1f4cd";

let ok = 0;
for (let i = 0; i < seeds.length; i++) {
  const url = `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(
    seeds[i],
  )}&radius=50&backgroundColor=${bg}`;
  try {
    const svg = await fetch(url).then((r) => r.text());
    if (!svg.includes("<svg")) throw new Error("not svg");
    writeFileSync(`public/avatars/preset-${i + 1}.svg`, svg);
    ok++;
  } catch (e) {
    console.log(`preset-${i + 1} FAILED:`, e.message);
  }
}
console.log(`saved ${ok}/${seeds.length} preset avatars to public/avatars/`);
