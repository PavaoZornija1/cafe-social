/**
 * Strip near-black background from pixel-art sprite sheets (AI sheets often use #000).
 * Usage: node scripts/make-spritesheet-transparent.mjs <path.png> [threshold]
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';

const path = process.argv[2];
const threshold = Number(process.argv[3] ?? 32);

if (!path) {
  console.error('Usage: node scripts/make-spritesheet-transparent.mjs <path.png> [threshold]');
  process.exit(1);
}

const input = readFileSync(path);
const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

let cleared = 0;
for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (r <= threshold && g <= threshold && b <= threshold) {
    data[i + 3] = 0;
    cleared += 1;
  }
}

await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png()
  .toFile(path);

console.log(
  `${path}: ${info.width}x${info.height}, cleared ${cleared} pixels (threshold ${threshold})`,
);
