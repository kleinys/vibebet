/**
 * Removes uniform / checkerboard backgrounds from character WebP art.
 * Uses edge flood-fill for light, dark, and gray checkerboard exports.
 * Run: npm run matte:characters  (also runs on Vercel build)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dirs = ["public/characters/animals", "public/characters/humans"];

const MATCH = 40;
const FEATHER = 16;
const GRAY_FLAT_MAX = 28; // max channel spread for neutral gray bg tiles

const WEBP = { quality: 82, effort: 4, alphaQuality: 92 };

function luminance(r, g, b) {
  return (r + g + b) / 3;
}

function isNeutralGray(r, g, b) {
  return (
    luminance(r, g, b) >= 175 &&
    Math.max(r, g, b) - Math.min(r, g, b) <= GRAY_FLAT_MAX
  );
}

function matchesBackground(r, g, b, bgColors) {
  for (const bg of bgColors) {
    if (Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2])) <= MATCH) {
      return true;
    }
  }
  return isNeutralGray(r, g, b);
}

function sampleEdgeColors(data, width, height) {
  const colors = new Map();
  const add = (x, y) => {
    const i = (y * width + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${Math.round(r / 8)},${Math.round(g / 8)},${Math.round(b / 8)}`;
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

function floodFillBackground(data, width, height, bgColors) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x++) {
    queue.push(x, 0, x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    queue.push(0, y, width - 1, y);
  }

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;

    const pi = y * width + x;
    if (visited[pi]) continue;

    const i = pi * 4;
    if (!matchesBackground(data[i], data[i + 1], data[i + 2], bgColors)) continue;

    visited[pi] = 1;
    data[i + 3] = 0;
    queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  // Feather edges touching the flood
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      const i = pi * 4;
      if (visited[pi]) continue;

      let minDist = 99;
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

      if (matchesBackground(data[i], data[i + 1], data[i + 2], bgColors)) {
        data[i + 3] = 0;
      } else if (minDist <= MATCH + FEATHER) {
        data[i + 3] = Math.min(
          data[i + 3],
          Math.round(((minDist - MATCH) / FEATHER) * 255),
        );
      }
    }
  }
}

/** Remove tiny opaque islands left after matte (the white speckle dots). */
function despeckle(data, width, height) {
  const alpha = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) {
    alpha[p] = data[p * 4 + 3];
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const pi = y * width + x;
      if (alpha[pi] < 200) continue;

      let transparentNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (alpha[(y + dy) * width + (x + dx)] < 32) transparentNeighbors++;
        }
      }

      // Isolated bright speck surrounded by transparency
      if (transparentNeighbors >= 6) {
        const i = pi * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (luminance(r, g, b) > 200 || isNeutralGray(r, g, b)) {
          data[i + 3] = 0;
        }
      }
    }
  }
}

for (const dir of dirs) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) continue;

  for (const file of fs.readdirSync(fullDir)) {
    if (!file.endsWith(".webp")) continue;

    const filePath = path.join(fullDir, file);
    const outPath = `${filePath}.tmp`;
    const { data, info } = await sharp(filePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bgColors = sampleEdgeColors(data, info.width, info.height);
    floodFillBackground(data, info.width, info.height, bgColors);
    despeckle(data, info.width, info.height);

    const buf = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .webp(WEBP)
      .toBuffer();

    try {
      fs.writeFileSync(outPath, buf);
      fs.renameSync(outPath, filePath);
      const meta = await sharp(filePath).metadata();
      console.log(`matted ${dir}/${file} (alpha: ${meta.hasAlpha})`);
    } catch {
      console.warn(`skip ${dir}/${file} (file locked — stop dev server or matte runs on Vercel build)`);
    }
  }
}

console.log("Done — backgrounds removed from character WebP art.");
