/**
 * Downloads CC0 / free seamless loop candidates from OpenGameArt for A/B testing.
 * License notes in assets/sounds/music/alternates/ATTRIBUTION.md
 *
 * Run: node scripts/fetch-seamless-music-alternates.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../assets/sounds/music/alternates');
const tmpDir = path.join(__dirname, '../.tmp-seamless-music');

const OGA = 'https://opengameart.org/sites/default/files';

/** url filename on OGA → output base name (home / game). */
const DOWNLOADS = [
  {
    url: `${OGA}/bird_in_hand_night.ogg`,
    tmp: 'bird_in_hand_night.ogg',
    out: 'seamless_home_bird_night.m4a',
    role: 'home',
    note: 'Soft jazz night — calm café bed (CC0 derivative, Fupi)',
  },
  {
    url: `${OGA}/little_cafe.wav`,
    tmp: 'little_cafe.wav',
    out: 'seamless_home_coffee_house.m4a',
    role: 'home',
    note: 'Coffee House Bump — jazz-y café loop (OatCog, OpenGameArt)',
  },
  {
    url: `${OGA}/headinthesand.ogg`,
    tmp: 'headinthesand.ogg',
    out: 'seamless_game_head_sand.m4a',
    role: 'game',
    note: 'Upbeat NES-style loop, tagged seamless (CC-BY 3.0, congusbongus)',
  },
  {
    url: `${OGA}/Swinging%20Sweet.ogg`,
    tmp: 'Swinging Sweet.ogg',
    out: 'seamless_home_swinging_sweet.m4a',
    role: 'home',
    note: 'Short seamless loop pack — warm (hernandack, free use)',
  },
];

function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execSync(`curl -fsSL ${JSON.stringify(url)} -o ${JSON.stringify(dest)}`, {
    stdio: 'inherit',
  });
}

function toM4a(src, dest) {
  execSync(
    `ffmpeg -y -i ${JSON.stringify(src)} -c:a aac -b:a 128k -ac 2 -ar 44100 ${JSON.stringify(dest)}`,
    { stdio: 'ignore' },
  );
}

if (!hasFfmpeg()) {
  console.error('ffmpeg is required to build iOS-friendly m4a previews.');
  process.exit(1);
}

fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const manifest = [];

for (const item of DOWNLOADS) {
  const src = path.join(tmpDir, item.tmp);
  const dest = path.join(outDir, item.out);
  download(item.url, src);
  toM4a(src, dest);
  manifest.push({ file: item.out, role: item.role, note: item.note });
  console.log(`✓ ${item.out} (${item.role})`);
}

fs.writeFileSync(
  path.join(outDir, 'ATTRIBUTION.md'),
  `# Seamless loop alternates (audition pack)

Downloaded for A/B testing against Kenney loops. **Verify license on each OpenGameArt page before shipping.**

| File | Role | Source |
|------|------|--------|
| seamless_home_bird_night.m4a | Home | [Bird in Hand Night](https://opengameart.org/content/bird-in-hand-night) — CC0 derivative |
| seamless_home_coffee_house.m4a | Home | [Coffee House Bump](https://opengameart.org/content/coffee-house-bump) — check OGA license |
| seamless_home_swinging_sweet.m4a | Home | [Short Loops pack](https://opengameart.org/content/short-loops-background-music-pack) — free use, credit appreciated |
| seamless_game_head_sand.m4a | Game | [Head in the Sand](https://opengameart.org/content/head-in-the-sand-seamless-loop) — CC-BY 3.0 |

Switch packs in \`app/src/lib/feedback/musicPack.ts\`.

Fetched via \`node scripts/fetch-seamless-music-alternates.mjs\`.
`,
);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Done. Set MUSIC_PACK in musicPack.ts to audition.');
