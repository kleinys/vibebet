/**
 * Conservative edge flood-fill — removes backdrop connected to image borders only.
 * Does NOT strip white highlights inside the character (no global gray key).
 * Run: npm run matte:characters
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dirs = ["public/characters/animals", "public/characters/humans"];

const DARK_MATCH = 38;
const LIGHT_MATCH = 12;
const FEATHER = 10;

const WEBP = { quality: 82, effort: 4, alphaQuality: 92 };

function luminance(r, g, b) {
  return (r + g + b) / 3;
}

function matchesBg(r, g, b, bgColors, tolerance) {
  for (const bg of bgColors) {
    if (Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2])) <= tolerance) {
      return true;
    }
  }
  return false;
}

function sampleEdgeColors(data, width, height) {
  const colors = new Map();
  const add = (x, y) => {
    const i = (y * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.round(r / 10)},${Math.round(g / 10)},${Math.round(b / 10)}`;
    colors.set(key, [r, g, b]);
  };

  for (let x = 0; x < width; x++) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    add(0, y);
    add(width - 1, y);
  }

  return [...colors.values()];
}

function matchesBgPixel(r, g, b, bgColors, tolerance, lightBackdrop) {
  // On light exports, only key near-pure backdrop whites — keep subject highlights.
  if (lightBackdrop && luminance(r, g, b) < 248) return false;
  return matchesBg(r, g, b, bgColors, tolerance);
}

function floodFillBackground(data, width, height, bgColors) {
  const avgLum =
    bgColors.reduce((sum, bg) => sum + luminance(bg[0], bg[1], bg[2]), 0) / bgColors.length;
  const lightBackdrop = avgLum >= 96;
  const tolerance = lightBackdrop ? LIGHT_MATCH : DARK_MATCH;

  const visited = new Uint8Array(width * height);
  const queue = [];

  const tryPush = (x, y, requireAdjacentClear) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pi = y * width + x;
    if (visited[pi]) return;
    const i = pi * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (requireAdjacentClear) {
      let touchesClear = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (data[(ny * width + nx) * 4 + 3] === 0) touchesClear = true;
        }
      }
      if (!touchesClear) return;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (luminance(r, g, b) < 190 || spread > 22) return;
      if (!matchesBg(r, g, b, bgColors, tolerance + 6)) return;
    } else if (!matchesBgPixel(r, g, b, bgColors, tolerance, lightBackdrop)) {
      return;
    }

    visited[pi] = 1;
    data[i + 3] = 0;
    queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0, false);
    tryPush(x, height - 1, false);
  }
  for (let y = 1; y < height - 1; y++) {
    tryPush(0, y, false);
    tryPush(width - 1, y, false);
  }

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    tryPush(x, y, false);
  }

  if (lightBackdrop) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tryPush(x, y, true);
      }
    }
    while (queue.length) {
      const y = queue.pop();
      const x = queue.pop();
      tryPush(x, y, true);
    }
  }

  // Feather only pixels adjacent to removed backdrop (keeps subject whites intact)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      if (visited[pi]) continue;

      let touchesBg = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (visited[ny * width + nx]) touchesBg = true;
        }
      }
      if (!touchesBg) continue;

      const i = pi * 4;
      if (!matchesBgPixel(data[i], data[i + 1], data[i + 2], bgColors, tolerance + FEATHER, lightBackdrop)) continue;

      let minDist = FEATHER + 1;
      for (const bg of bgColors) {
        minDist = Math.min(
          minDist,
          Math.max(
            Math.abs(data[i] - bg[0]),
            Math.abs(data[i + 1] - bg[1]),
            Math.abs(data[i + 2] - bg[2]),
          ),
        );
      }
      if (minDist <= tolerance + FEATHER) {
        data[i + 3] = Math.min(
          data[i + 3],
          Math.round(((minDist - tolerance) / FEATHER) * 255),
        );
      }
    }
  }
}

for (const dir of dirs) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) continue;

  for (const file of fs.readdirSync(fullDir)) {
    if (!file.endsWith(".webp") || file.includes(".matte-out")) continue;

    const filePath = path.join(fullDir, file);
    const outPath = `${filePath}.matte-out.webp`;
    const { data, info } = await sharp(filePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bgColors = sampleEdgeColors(data, info.width, info.height);
    floodFillBackground(data, info.width, info.height, bgColors);

    const buf = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .webp(WEBP)
      .toBuffer();

    try {
      fs.writeFileSync(outPath, buf);
      fs.renameSync(outPath, filePath);
      console.log(`matted ${dir}/${file}`);
    } catch {
      const cachePath = path.join(root, "scripts", "character-art-matted", dir, file);
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, buf);
      console.warn(`cached ${dir}/${file} (source file locked)`);
    }
  }
}

console.log("Done — edge flood-fill only (subject colors preserved).");
