/**
 * Removes export backdrops (white, gray checkerboard, dark navy) via edge flood-fill.
 * Preserves subject colors — only removes backdrop connected to image borders.
 * Run locally: npm run matte:characters  then commit public/characters/*.webp
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dirs = [
  "public/characters/animals",
  "public/characters/humans",
  "public/characters/phenomena",
];

const DARK_MATCH = 38;
const LIGHT_MATCH = 14;
const CHECKER_GRAY_MAX_LUM = 225;
const CHECKER_GRAY_MIN_LUM = 188;
const FEATHER = 10;

const WEBP = { quality: 90, effort: 4, alphaQuality: 100, nearLossless: true };

function luminance(r, g, b) {
  return (r + g + b) / 3;
}

function colorSpread(r, g, b) {
  return Math.max(r, g, b) - Math.min(r, g, b);
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

  const sampled = [...colors.values()];
  const avgLum =
    sampled.reduce((sum, c) => sum + luminance(c[0], c[1], c[2]), 0) / sampled.length;

  if (avgLum >= 96) {
    for (const c of [
      [255, 255, 255],
      [204, 204, 204],
      [218, 218, 218],
      [236, 236, 236],
    ]) {
      sampled.push(c);
    }
  }

  return sampled;
}

function isPass1Backdrop(r, g, b, bgColors, lightBackdrop, tolerance) {
  const lum = luminance(r, g, b);
  const spread = colorSpread(r, g, b);

  if (!lightBackdrop) {
    return matchesBg(r, g, b, bgColors, tolerance);
  }

  if (lum >= 253 && spread < 12) return true;

  if (
    lum >= CHECKER_GRAY_MIN_LUM &&
    lum <= CHECKER_GRAY_MAX_LUM &&
    spread < 12 &&
    matchesBg(r, g, b, bgColors, tolerance + 6)
  ) {
    return true;
  }

  return false;
}

function isPass2CheckerGray(r, g, b, bgColors, tolerance) {
  const lum = luminance(r, g, b);
  const spread = colorSpread(r, g, b);
  if (lum < CHECKER_GRAY_MIN_LUM || lum > CHECKER_GRAY_MAX_LUM) return false;
  if (spread > 24) return false;
  return matchesBg(r, g, b, bgColors, tolerance + 10) || spread < 10;
}

function floodFillBackground(data, width, height, bgColors) {
  const avgLum =
    bgColors.reduce((sum, bg) => sum + luminance(bg[0], bg[1], bg[2]), 0) / bgColors.length;
  const lightBackdrop = avgLum >= 96;
  const tolerance = lightBackdrop ? LIGHT_MATCH : DARK_MATCH;

  const visited = new Uint8Array(width * height);
  const queue = [];

  const clear = (x, y) => {
    const pi = y * width + x;
    visited[pi] = 1;
    data[pi * 4 + 3] = 0;
    queue.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  };

  const tryPass1 = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pi = y * width + x;
    if (visited[pi]) return;
    const i = pi * 4;
    if (!isPass1Backdrop(data[i], data[i + 1], data[i + 2], bgColors, lightBackdrop, tolerance)) {
      return;
    }
    clear(x, y);
  };

  const tryPass2 = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pi = y * width + x;
    if (visited[pi]) return;

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

    const i = pi * 4;
    if (!isPass2CheckerGray(data[i], data[i + 1], data[i + 2], bgColors, tolerance)) return;
    clear(x, y);
  };

  for (let x = 0; x < width; x++) {
    tryPass1(x, 0);
    tryPass1(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    tryPass1(0, y);
    tryPass1(width - 1, y);
  }

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    tryPass1(x, y);
  }

  if (lightBackdrop) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tryPass2(x, y);
      }
    }
    while (queue.length) {
      const y = queue.pop();
      const x = queue.pop();
      tryPass2(x, y);
    }
  }

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
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = luminance(r, g, b);
      const spread = colorSpread(r, g, b);
      const backdrop = lightBackdrop
        ? (lum >= 248 && spread < 18) || isPass2CheckerGray(r, g, b, bgColors, tolerance)
        : matchesBg(r, g, b, bgColors, tolerance + FEATHER);
      if (!backdrop) continue;

      let minDist = FEATHER + 1;
      for (const bg of bgColors) {
        minDist = Math.min(
          minDist,
          Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2])),
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

function isBackdropPixel(r, g, b, { preserveWhiteBody = false } = {}) {
  const lum = luminance(r, g, b);
  const spread = colorSpread(r, g, b);
  if (spread > 12) return false;
  if (preserveWhiteBody && lum >= 238 && lum <= 252) return false;
  return lum >= 185 && lum <= 255;
}

const PALE_ART_FILES = new Set([
  "frost-walker.webp",
  "oracle-lunar.webp",
  "aurora-sage.webp",
  "nebula-ronin.webp",
]);

/** Fiery animals — edge-only matte so flame interiors are not punched out */
const FIRE_ART_FILES = new Set([
  "ember-cat.webp",
  "ember-tiger.webp",
  "sun-phoenix.webp",
]);

/** Never re-matte — use repair-fox-spirit.mjs instead */
const SKIP_MATTE_FILES = new Set(["fox-spirit.webp"]);

function isSubjectSeed(r, g, b, { paleArt = false } = {}) {
  const lum = luminance(r, g, b);
  const spread = colorSpread(r, g, b);
  if (paleArt) return spread > 14 || lum < 140;
  return spread > 22 || lum < 115;
}

function clearBackdropOutsideSubject(data, width, height, options = {}) {
  const subject = new Uint8Array(width * height);
  const queue = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      const i = pi * 4;
      if (data[i + 3] < 32) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isSubjectSeed(r, g, b, options)) continue;
      subject[pi] = 1;
      queue.push(x, y);
    }
  }

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const pi = ny * width + nx;
      if (subject[pi]) continue;
      const i = pi * 4;
      if (data[i + 3] < 32) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isBackdropPixel(r, g, b, options)) continue;
      subject[pi] = 1;
      queue.push(nx, ny);
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      const i = pi * 4;
      if (data[i + 3] < 32) continue;
      if (subject[pi]) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (isBackdropPixel(r, g, b, options)) {
        data[i + 3] = 0;
      }
    }
  }
}

function removeSmallBackdropIslands(data, width, height, minSize = 320) {
  const visited = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      if (visited[pi]) continue;
      const i = pi * 4;
      if (data[i + 3] < 32) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isBackdropPixel(r, g, b)) continue;

      const component = [];
      const queue = [x, y];
      visited[pi] = 1;

      while (queue.length) {
        const cy = queue.pop();
        const cx = queue.pop();
        component.push(cx, cy);

        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const npi = ny * width + nx;
          if (visited[npi]) continue;
          const ni = npi * 4;
          if (data[ni + 3] < 32) continue;
          const nr = data[ni];
          const ng = data[ni + 1];
          const nb = data[ni + 2];
          if (!isBackdropPixel(nr, ng, nb)) continue;
          visited[npi] = 1;
          queue.push(nx, ny);
        }
      }

      if (component.length / 2 >= minSize) continue;
      for (let j = 0; j < component.length; j += 2) {
        data[(component[j + 1] * width + component[j]) * 4 + 3] = 0;
      }
    }
  }
}

function removeOrphanBackdropPixels(data, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      const i = pi * 4;
      if (data[i + 3] < 32) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isBackdropPixel(r, g, b)) continue;

      let transparentNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (data[(ny * width + nx) * 4 + 3] < 32) transparentNeighbors++;
        }
      }
      if (transparentNeighbors >= 4) {
        data[i + 3] = 0;
      }
    }
  }
}

function cleanupAlphaFringe(data, width, height) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      const i = pi * 4;
      const alpha = data[i + 3];
      if (alpha === 0 || alpha === 255) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = luminance(r, g, b);
      const spread = colorSpread(r, g, b);

      let transparentNeighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (data[(ny * width + nx) * 4 + 3] < 32) transparentNeighbors++;
        }
      }

      if (transparentNeighbors >= 4 && (lum > 175 || spread < 18)) {
        data[i + 3] = 0;
        continue;
      }

      if (alpha < 96) {
        data[i + 3] = 0;
      } else if (alpha > 200) {
        data[i + 3] = 255;
      }
    }
  }
}

function binarizeAlpha(data) {
  for (let i = 3; i < data.length; i += 4) {
    data[i] = data[i] < 128 ? 0 : 255;
  }
}

function isNeutralBackdrop(r, g, b, { maxLum = 254, minLum = 188, maxSpread = 12 } = {}) {
  const lum = luminance(r, g, b);
  const spread = colorSpread(r, g, b);
  if (spread > maxSpread) return false;
  return lum >= minLum && lum <= maxLum;
}

function backdropFlood(data, width, height, options) {
  const visited = new Uint8Array(width * height);
  const queue = [];

  const tryClear = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const pi = y * width + x;
    if (visited[pi]) return;
    const i = pi * 4;
    if (data[i + 3] === 0) {
      visited[pi] = 1;
      queue.push(x, y);
      return;
    }
    if (!isNeutralBackdrop(data[i], data[i + 1], data[i + 2], options)) return;
    visited[pi] = 1;
    data[i + 3] = 0;
    queue.push(x, y);
  };

  for (let x = 0; x < width; x++) {
    tryClear(x, 0);
    tryClear(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryClear(0, y);
    tryClear(width - 1, y);
  }

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    tryClear(x + 1, y);
    tryClear(x - 1, y);
    tryClear(x, y + 1);
    tryClear(x, y - 1);
  }
}
function shallowHaloClear(data, width, height, maxDepth = 220) {
  const depth = new Int16Array(width * height).fill(-1);
  const queue = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pi = y * width + x;
      if (data[pi * 4 + 3] > 0) continue;
      depth[pi] = 0;
      queue.push(x, y);
    }
  }

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    const baseDepth = depth[y * width + x];

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const pi = ny * width + nx;
      if (depth[pi] !== -1) continue;

      const i = pi * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = luminance(r, g, b);
      const spread = colorSpread(r, g, b);
      const nextDepth = baseDepth + 1;
      if (nextDepth > maxDepth) continue;
      if (lum < 240 || spread > 14) continue;

      depth[pi] = nextDepth;
      data[i + 3] = 0;
      queue.push(nx, ny);
    }
  }
}

for (const dir of dirs) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) continue;

  for (const file of fs.readdirSync(fullDir)) {
    if (!file.endsWith(".webp") || file.includes(".matte-out")) continue;

    const filePath = path.join(fullDir, file);
    const { data, info } = await sharp(filePath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bgColors = sampleEdgeColors(data, info.width, info.height);
    const avgLum =
      bgColors.reduce((sum, bg) => sum + luminance(bg[0], bg[1], bg[2]), 0) / bgColors.length;

    const paleArt = PALE_ART_FILES.has(file);
    const fireArt = FIRE_ART_FILES.has(file);
    const skipMatte = SKIP_MATTE_FILES.has(file);
    const matteOptions = paleArt ? { preserveWhiteBody: true, paleArt: true } : {};

    if (skipMatte) {
      console.log(`skip ${dir}/${file} (manual art)`);
      continue;
    }

    if (fireArt) {
      floodFillBackground(data, info.width, info.height, bgColors);
    } else {
      clearBackdropOutsideSubject(data, info.width, info.height, matteOptions);
      removeSmallBackdropIslands(data, info.width, info.height);
      if (!paleArt) {
        removeOrphanBackdropPixels(data, info.width, info.height);
      }
      clearBackdropOutsideSubject(data, info.width, info.height, matteOptions);
      if (file === "spirit-stag.webp") {
        backdropFlood(data, info.width, info.height, { minLum: 180, maxSpread: 14 });
        removeSmallBackdropIslands(data, info.width, info.height, 64);
      }
      cleanupAlphaFringe(data, info.width, info.height);
      binarizeAlpha(data);

      if (avgLum < 96) {
        floodFillBackground(data, info.width, info.height, bgColors);
      }
    }

    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] >= 32) opaque++;
    }

    const buf = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .trim({ threshold: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp(WEBP)
      .toBuffer();

    const cachePath = path.join(root, "scripts", "character-art-matted", dir, file);
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, buf);

    const ratio = ((opaque / (data.length / 4)) * 100).toFixed(1);
    console.log(`matted ${dir}/${file} (${ratio}% opaque)`);
  }
}

console.log("Done — wrote scripts/character-art-matted/ (copy into public/characters and commit).");
