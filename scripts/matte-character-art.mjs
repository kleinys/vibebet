/**
 * Removes near-white or near-dark uniform backgrounds from character WebP art.
 * Run after compress:characters or when art looks like flat stickers:
 *   npm run matte:characters
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dirs = ["public/characters/animals", "public/characters/humans"];
const WHITE_THRESHOLD = 235;
const DARK_LUMINANCE = 95;
const DARK_MATCH = 32;
const DARK_FEATHER = 14;

const WEBP = { quality: 82, effort: 4, alphaQuality: 92 };

function sampleCorners(data, width, height) {
  const points = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const [x, y] of points) {
    const i = (y * width + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return [r / 4, g / 4, b / 4];
}

function mattePixel(data, i, bg, mode) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

  if (mode === "dark") {
    const dr = Math.abs(r - bg[0]);
    const dg = Math.abs(g - bg[1]);
    const db = Math.abs(b - bg[2]);
    const dist = Math.max(dr, dg, db);
    if (dist <= DARK_MATCH) {
      data[i + 3] = 0;
    } else if (dist <= DARK_MATCH + DARK_FEATHER) {
      data[i + 3] = Math.round(((dist - DARK_MATCH) / DARK_FEATHER) * 255);
    }
    return;
  }

  if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
    data[i + 3] = 0;
  } else if (r >= 230 && g >= 230 && b >= 230) {
    const edge = Math.min(r, g, b);
    data[i + 3] = Math.round(((242 - edge) / 12) * 255);
  }
}

for (const dir of dirs) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) continue;

  for (const file of fs.readdirSync(fullDir)) {
    if (!file.endsWith(".webp")) continue;

    const filePath = path.join(fullDir, file);
    const img = sharp(filePath);
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const bg = sampleCorners(data, info.width, info.height);
    const luminance = (bg[0] + bg[1] + bg[2]) / 3;
    const mode = luminance < DARK_LUMINANCE ? "dark" : "light";

    for (let i = 0; i < data.length; i += 4) {
      mattePixel(data, i, bg, mode);
    }

    const buf = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .webp(WEBP)
      .toBuffer();

    try {
      fs.writeFileSync(filePath, buf);
      console.log(`matted ${dir}/${file} (${mode} bg)`);
    } catch {
      console.warn(`skip ${dir}/${file} (file locked — stop dev server or matte runs on Vercel build)`);
    }
  }
}

console.log("Done — backgrounds removed from character WebP art.");
