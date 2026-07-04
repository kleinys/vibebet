/**
 * One-off repair for fox-spirit.webp — restores body cohesion after aggressive matting.
 * Boosts warm flame alpha and bridges small gaps between head/torso/tail.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const foxPath = path.join(__dirname, "..", "public", "characters", "animals", "fox-spirit.webp");
const outPath = path.join(__dirname, "fox-spirit-repaired.webp");

function luminance(r, g, b) {
  return (r + g + b) / 3;
}

function colorSpread(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isWarmFlame(r, g, b, { loose = false } = {}) {
  const spread = colorSpread(r, g, b);
  const lum = luminance(r, g, b);
  if (lum < 22 || lum > 252) return false;
  if (spread < (loose ? 10 : 14)) return false;
  return r >= g * (loose ? 0.72 : 0.82);
}

function strengthenFireAlpha(data, width, height) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 8) continue;
    if (!isWarmFlame(r, g, b)) continue;
    if (a < 220) data[i + 3] = Math.min(255, Math.round(a + (240 - a) * 0.92));
  }

  const alpha = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      alpha[y * width + x] = data[(y * width + x) * 4 + 3];
    }
  }

  const neighbors = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [-3, 0],
    [3, 0],
    [0, -3],
    [0, 3],
  ];

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const pi = y * width + x;
      if (alpha[pi] >= 48) continue;

      let strong = 0;
      for (const [dx, dy] of neighbors) {
        if (alpha[(y + dy) * width + (x + dx)] >= 170) strong++;
      }
      if (strong < 3) continue;

      const i = pi * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isWarmFlame(r, g, b, { loose: true })) continue;
      data[i + 3] = alpha[pi] > 0 ? 210 : 185;
    }
  }
}

const { data, info } = await sharp(foxPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

strengthenFireAlpha(data, info.width, info.height);

const buf = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .webp({ quality: 92, effort: 4, alphaQuality: 100, nearLossless: true })
  .toBuffer();

fs.writeFileSync(outPath, buf);

let opaque = 0;
for (let i = 3; i < data.length; i += 4) {
  if (data[i] >= 200) opaque++;
}
console.log(
  `Repaired fox-spirit.webp (${info.width}x${info.height}) — ${((opaque / (data.length / 4)) * 100).toFixed(1)}% opaque`,
);
