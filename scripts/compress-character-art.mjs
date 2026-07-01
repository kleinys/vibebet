/**
 * Converts character PNG files under public/characters to WebP.
 * Run after adding or updating character PNG source art:
 *   npm run compress:characters
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dirs = ["public/characters/animals", "public/characters/humans"];

const WEBP = { quality: 82, effort: 4, alphaQuality: 90 };

let totalBefore = 0;
let totalAfter = 0;

for (const dir of dirs) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) continue;

  for (const file of fs.readdirSync(fullDir)) {
    if (!file.endsWith(".png")) continue;

    const input = path.join(fullDir, file);
    const output = path.join(fullDir, file.replace(/\.png$/i, ".webp"));
    const before = fs.statSync(input).size;

    await sharp(input).webp(WEBP).toFile(output);

    const after = fs.statSync(output).size;
    totalBefore += before;
    totalAfter += after;
    const pct = ((1 - after / before) * 100).toFixed(1);
    console.log(`${dir}/${file}: ${fmt(before)} → ${fmt(after)} (−${pct}%)`);
  }
}

console.log(`\nTotal: ${fmt(totalBefore)} → ${fmt(totalAfter)} (−${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%)`);

function fmt(bytes) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
