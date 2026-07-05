/**
 * Remove baked checkerboard / dark backdrops from generated locker PNGs.
 * Run: node scripts/matte-locker-assets.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "public", "locker-assets");

function luminance(r, g, b) {
  return (r + g + b) / 3;
}

function colorSpread(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
}

function isBackdrop(r, g, b, avgLum) {
  const lum = luminance(r, g, b);
  const spread = colorSpread(r, g, b);
  if (lum >= 248 && spread < 12) return true;
  if (lum >= 188 && lum <= 225 && spread < 18) return true;
  if (avgLum >= 120 && lum >= 200 && spread < 20) return true;
  if (avgLum < 80 && lum < 28 && spread < 16) return true;
  return false;
}

function floodBackdrop(data, w, h) {
  const visited = new Uint8Array(w * h);
  const queue = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x !== 0 && y !== 0 && x !== w - 1 && y !== h - 1) continue;
      queue.push(x, y);
    }
  }

  const edge = [];
  for (let i = 0; i < data.length; i += 4) {
    edge.push(luminance(data[i], data[i + 1], data[i + 2]));
  }
  const avgLum = edge.reduce((a, b) => a + b, 0) / edge.length;

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    const pi = y * w + x;
    if (visited[pi]) continue;
    visited[pi] = 1;
    const i = pi * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isBackdrop(r, g, b, avgLum)) continue;
    data[i + 3] = 0;
    if (x > 0) queue.push(x - 1, y);
    if (x < w - 1) queue.push(x + 1, y);
    if (y > 0) queue.push(x, y - 1);
    if (y < h - 1) queue.push(x, y + 1);
  }
}

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".png")) continue;
  const filePath = path.join(dir, file);
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  floodBackdrop(data, info.width, info.height);
  const outPath = filePath.replace(/\.png$/i, ".webp");
  const buf = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ threshold: 10, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, effort: 4, alphaQuality: 100, nearLossless: true })
    .toBuffer();
  fs.writeFileSync(outPath, buf);
  console.log(`matted ${file} -> ${path.basename(outPath)} (${buf.length} bytes)`);
}

console.log("Done — update LOCKER_ASSETS_VERSION and point locker-assets.ts to .webp");
