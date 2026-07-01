/**
 * Removes near-white backgrounds from character WebP art for transparent figures.
 * Run after compress:characters or when art looks like flat stickers:
 *   npm run matte:characters
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dirs = ["public/characters/animals", "public/characters/humans"];
const THRESHOLD = 235;

const WEBP = { quality: 82, effort: 4, alphaQuality: 92 };

for (const dir of dirs) {
  const fullDir = path.join(root, dir);
  if (!fs.existsSync(fullDir)) continue;

  for (const file of fs.readdirSync(fullDir)) {
    if (!file.endsWith(".webp")) continue;

    const filePath = path.join(fullDir, file);
    const img = sharp(filePath);
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r >= THRESHOLD && g >= THRESHOLD && b >= THRESHOLD) {
        data[i + 3] = 0;
      } else if (r >= 230 && g >= 230 && b >= 230) {
        const edge = Math.min(r, g, b);
        data[i + 3] = Math.round(((242 - edge) / 12) * 255);
      }
    }

    const outPath = path.join(fullDir, file);
    const tmpPath = path.join(os.tmpdir(), `vibebet-matte-${file}`);

    await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .webp(WEBP)
      .toFile(tmpPath);

    fs.copyFileSync(tmpPath, outPath);
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
    console.log(`matted ${dir}/${file}`);
  }
}

console.log("Done — white backgrounds removed from character WebP art.");
