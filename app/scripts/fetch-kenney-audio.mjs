/**
 * Fetches Kenney CC0 audio (https://kenney.nl) into app/assets/sounds.
 * License: CC0 — https://creativecommons.org/publicdomain/zero/1.0/
 *
 * Run: node scripts/fetch-kenney-audio.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const soundsDir = path.join(__dirname, '../assets/sounds');
const musicDir = path.join(soundsDir, 'music');
const tmpDir = path.join(__dirname, '../.tmp-kenney-audio');

const GAMESOUNDS = 'https://www.gamesounds.xyz/Kenney%27s%20Sound%20Pack';

/** Remote path (under Kenney pack) → local filename (before conversion). */
const REMOTE_SFX = [
  ['Interface Sounds/confirmation_004.ogg', 'correct.ogg'],
  ['Interface Sounds/error_006.ogg', 'wrong.ogg'],
  ['Interface Sounds/pluck_002.ogg', 'daily_solved.ogg'],
  ['Interface Sounds/error_003.ogg', 'daily_failed.ogg'],
  ['Interface Sounds/tick_001.ogg', 'timer_urgent.ogg'],
  ['Interface Sounds/question_002.ogg', 'timer_up.ogg'],
  ['Voiceover Pack/Audio (Female)/you_win.ogg', 'match_win.ogg'],
  ['Voiceover Pack/Audio (Female)/you_lose.ogg', 'match_loss.ogg'],
  ['Interface Sounds/open_002.ogg', 'lobby_ready.ogg'],
  ['Interface Sounds/select_007.ogg', 'lobby_joined.ogg'],
  ['Interface Sounds/maximize_008.ogg', 'lobby_start.ogg'],
  ['Interface Sounds/bong_001.ogg', 'lobby_found.ogg'],
  ['Interface Sounds/back_003.ogg', 'lobby_left.ogg'],
  ['Impact Sounds/impactPunch_medium_002.ogg', 'brawler_hit.ogg'],
  ['Impact Sounds/impactPunch_heavy_003.ogg', 'brawler_ko.ogg'],
  ['Interface Sounds/glass_004.ogg', 'perk_redeemed.ogg'],
  ['RPG Audio/handleCoins.ogg', 'check_in.ogg'],
];

const REMOTE_MUSIC = [
  ['Music Loops/Loops/Farm Frolics.ogg', 'music/cafe_home.ogg'],
  ['Music Loops/Loops/Mishief Stroll.ogg', 'music/cafe_game.ogg'],
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

function remoteUrl(relativePath) {
  return `${GAMESOUNDS}/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

function toWav(src, dest) {
  execSync(
    `ffmpeg -y -i "${src}" -ac 1 -ar 44100 -sample_fmt s16 "${dest}"`,
    { stdio: 'ignore' },
  );
}

function toM4aLoop(src, dest) {
  execSync(
    `ffmpeg -y -i "${src}" -c:a aac -b:a 128k -ac 2 -ar 44100 "${dest}"`,
    { stdio: 'ignore' },
  );
}

fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });
fs.mkdirSync(musicDir, { recursive: true });

const ffmpeg = hasFfmpeg();
if (!ffmpeg) {
  console.warn('ffmpeg not found — keeping .ogg files (iOS may not play them). Install ffmpeg for best results.');
}

for (const [remote, local] of REMOTE_SFX) {
  const url = remoteUrl(remote);
  const oggPath = path.join(tmpDir, local);
  download(url, oggPath);
  const outName = local.replace(/\.ogg$/, '.wav');
  const outPath = path.join(soundsDir, outName);
  if (ffmpeg) {
    toWav(oggPath, outPath);
    console.log(`✓ ${outName}`);
  } else {
    fs.copyFileSync(oggPath, path.join(soundsDir, local));
    console.log(`✓ ${local}`);
  }
}

for (const [remote, local] of REMOTE_MUSIC) {
  const url = remoteUrl(remote);
  const oggPath = path.join(tmpDir, path.basename(local));
  download(url, oggPath);
  const outName = path.basename(local).replace(/\.ogg$/, '.m4a');
  const outPath = path.join(musicDir, outName);
  if (ffmpeg) {
    toM4aLoop(oggPath, outPath);
    console.log(`✓ music/${outName}`);
  } else {
    fs.copyFileSync(oggPath, path.join(musicDir, path.basename(local)));
    console.log(`✓ music/${path.basename(local)}`);
  }
}

fs.writeFileSync(
  path.join(soundsDir, 'ATTRIBUTION.md'),
  `# Sound assets

Audio by [Kenney](https://www.kenney.nl) — [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

Packs used: Interface Sounds, Impact Sounds, RPG Audio, Voiceover Pack, Music Loops.

Fetched via \`node scripts/fetch-kenney-audio.mjs\`.
`,
);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('Done.');
