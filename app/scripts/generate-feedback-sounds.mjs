/**
 * Generates short café-friendly WAV cues for in-app feedback.
 * Run: node scripts/generate-feedback-sounds.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../assets/sounds');

function writeToneWav(filePath, frequency, durationSec, volume = 0.28) {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const attack = 0.008;
    const release = Math.min(0.12, durationSec * 0.45);
    let env = 1;
    if (t < attack) env = t / attack;
    else if (t > durationSec - release) env = Math.max(0, (durationSec - t) / release);
    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * env;
    buffer.writeInt16LE(
      Math.max(-32767, Math.min(32767, Math.floor(sample * 32767))),
      44 + i * 2,
    );
  }

  fs.writeFileSync(filePath, buffer);
}

function writeSequenceWav(filePath, tones, volume = 0.24) {
  const sampleRate = 22050;
  const gap = 0.028;
  const totalDur = tones.reduce((s, t) => s + t.dur + gap, -gap);
  const numSamples = Math.floor(sampleRate * totalDur);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offsetSec = 0;
  for (const tone of tones) {
    const startSample = Math.floor(offsetSec * sampleRate);
    const toneSamples = Math.floor(tone.dur * sampleRate);
    for (let i = 0; i < toneSamples; i++) {
      const idx = startSample + i;
      if (idx >= numSamples) break;
      const t = i / sampleRate;
      const attack = 0.006;
      const release = Math.min(0.1, tone.dur * 0.4);
      let env = 1;
      if (t < attack) env = t / attack;
      else if (t > tone.dur - release) env = Math.max(0, (tone.dur - t) / release);
      const sample = Math.sin(2 * Math.PI * tone.f * t) * volume * env;
      buffer.writeInt16LE(
        Math.max(-32767, Math.min(32767, Math.floor(sample * 32767))),
        44 + idx * 2,
      );
    }
    offsetSec += tone.dur + gap;
  }

  fs.writeFileSync(filePath, buffer);
}

fs.mkdirSync(outDir, { recursive: true });

writeToneWav(path.join(outDir, 'correct.wav'), 784, 0.11, 0.26);
writeToneWav(path.join(outDir, 'wrong.wav'), 196, 0.14, 0.22);
writeSequenceWav(path.join(outDir, 'daily_solved.wav'), [
  { f: 523, dur: 0.09 },
  { f: 659, dur: 0.09 },
  { f: 784, dur: 0.14 },
]);
writeSequenceWav(path.join(outDir, 'daily_failed.wav'), [
  { f: 392, dur: 0.12 },
  { f: 294, dur: 0.16 },
]);
writeToneWav(path.join(outDir, 'timer_urgent.wav'), 440, 0.09, 0.2);
writeToneWav(path.join(outDir, 'timer_up.wav'), 311, 0.22, 0.24);
writeSequenceWav(path.join(outDir, 'match_win.wav'), [
  { f: 523, dur: 0.08 },
  { f: 659, dur: 0.08 },
  { f: 784, dur: 0.12 },
]);
writeSequenceWav(path.join(outDir, 'match_loss.wav'), [
  { f: 349, dur: 0.1 },
  { f: 262, dur: 0.14 },
]);
writeToneWav(path.join(outDir, 'lobby_ready.wav'), 587, 0.1, 0.18);
writeToneWav(path.join(outDir, 'lobby_joined.wav'), 659, 0.1, 0.2);
writeSequenceWav(path.join(outDir, 'lobby_start.wav'), [
  { f: 440, dur: 0.07 },
  { f: 554, dur: 0.07 },
  { f: 659, dur: 0.1 },
]);
writeToneWav(path.join(outDir, 'lobby_found.wav'), 698, 0.12, 0.22);
writeToneWav(path.join(outDir, 'lobby_left.wav'), 247, 0.12, 0.16);
writeToneWav(path.join(outDir, 'brawler_hit.wav'), 320, 0.05, 0.18);
writeToneWav(path.join(outDir, 'brawler_ko.wav'), 180, 0.14, 0.26);
writeSequenceWav(path.join(outDir, 'perk_redeemed.wav'), [
  { f: 587, dur: 0.08 },
  { f: 740, dur: 0.11 },
]);
writeSequenceWav(path.join(outDir, 'check_in.wav'), [
  { f: 494, dur: 0.08 },
  { f: 622, dur: 0.1 },
]);

console.log(`Wrote feedback sounds to ${outDir}`);
