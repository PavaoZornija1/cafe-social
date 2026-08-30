import type { HeroSpriteAnim } from '../../components/HeroSpriteView';

export type RemoteFighterSnapshot = {
  participantId: string;
  brawlerHeroId: string | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  isBot: boolean;
  anim: HeroSpriteAnim;
};

export type RemoteFighterRender = RemoteFighterSnapshot & {
  displayX: number;
  displayY: number;
};

const INTERP_BUFFER_MS = 100;

type Sample = RemoteFighterSnapshot & { atMs: number };

type FighterTrack = {
  samples: Sample[];
};

function deriveAnim(vx: number, vy: number): HeroSpriteAnim {
  if (vy < -80) return 'jump';
  if (Math.abs(vx) > 40) return 'walk';
  return 'idle';
}

export function fighterPixelsToSnapshots(
  fighters: Array<{
    participantId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: number;
    hp: number;
    maxHp: number;
    alive: boolean;
    isBot: boolean;
  }>,
  heroIdByParticipant: Map<string, string | null | undefined>,
  localParticipantId: string | null,
): RemoteFighterSnapshot[] {
  return fighters
    .filter((f) => f.participantId !== localParticipantId)
    .map((f) => ({
      participantId: f.participantId,
      brawlerHeroId: heroIdByParticipant.get(f.participantId) ?? null,
      x: f.x,
      y: f.y,
      vx: f.vx,
      vy: f.vy,
      facing: f.facing,
      hp: f.hp,
      maxHp: f.maxHp,
      alive: f.alive,
      isBot: f.isBot,
      anim: deriveAnim(f.vx, f.vy),
    }));
}

export class RemoteFighterInterpolator {
  private tracks = new Map<string, FighterTrack>();

  ingest(snapshots: RemoteFighterSnapshot[], atMs: number): void {
    const seen = new Set<string>();
    for (const s of snapshots) {
      seen.add(s.participantId);
      const track = this.tracks.get(s.participantId) ?? { samples: [] };
      track.samples.push({ ...s, atMs });
      while (
        track.samples.length > 2 &&
        atMs - track.samples[0]!.atMs > INTERP_BUFFER_MS * 3
      ) {
        track.samples.shift();
      }
      this.tracks.set(s.participantId, track);
    }
    for (const id of [...this.tracks.keys()]) {
      if (!seen.has(id)) this.tracks.delete(id);
    }
  }

  render(nowMs: number): RemoteFighterRender[] {
    const out: RemoteFighterRender[] = [];
    for (const [participantId, track] of this.tracks) {
      const samples = track.samples;
      if (samples.length === 0) continue;
      const latest = samples[samples.length - 1]!;
      if (samples.length === 1) {
        out.push({
          ...latest,
          displayX: latest.x,
          displayY: latest.y,
        });
        continue;
      }
      const prev = samples[samples.length - 2]!;
      const span = Math.max(1, latest.atMs - prev.atMs);
      const t = Math.max(0, Math.min(1, (nowMs - prev.atMs) / span));
      out.push({
        ...latest,
        participantId,
        displayX: prev.x + (latest.x - prev.x) * t,
        displayY: prev.y + (latest.y - prev.y) * t,
      });
    }
    return out;
  }

  clear(): void {
    this.tracks.clear();
  }
}

export function reconcileLocalPosition(params: {
  localX: number;
  localY: number;
  serverX: number;
  serverY: number;
  thresholdPx?: number;
  lerp?: number;
}): { x: number; y: number; snapped: boolean } {
  const threshold = params.thresholdPx ?? 24;
  const lerp = params.lerp ?? 0.35;
  const dx = params.serverX - params.localX;
  const dy = params.serverY - params.localY;
  const err = Math.hypot(dx, dy);
  if (err > threshold * 3) {
    return { x: params.serverX, y: params.serverY, snapped: true };
  }
  if (err > threshold) {
    return {
      x: params.localX + dx * lerp,
      y: params.localY + dy * lerp,
      snapped: false,
    };
  }
  return { x: params.localX, y: params.localY, snapped: false };
}
