import {
  buildArenaPlatforms,
  EXPECTED_ARENA_PLATFORM_COUNT,
  spawnFightersOnBottomPlatform,
} from './brawler-arena-platforms.util';
import { REF_WORLD_H, REF_WORLD_W } from './brawler-combat.constants';

describe('brawler-arena-platforms.util', () => {
  it('builds the same platform count as the client layout', () => {
    const plats = buildArenaPlatforms(REF_WORLD_W, REF_WORLD_H);
    expect(plats.length).toBe(EXPECTED_ARENA_PLATFORM_COUNT);
  });

  it('spawns fighters spread on the bottom platform', () => {
    const spawns = spawnFightersOnBottomPlatform(4, REF_WORLD_W, REF_WORLD_H);
    expect(spawns).toHaveLength(4);
    const xs = spawns.map((s) => s.x);
    expect(new Set(xs).size).toBe(4);
  });
});
