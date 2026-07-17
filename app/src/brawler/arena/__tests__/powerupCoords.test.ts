import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  denormalizeArenaSpawn,
  denormalizePowerupCoords,
  normalizePowerupCoords,
} from '../powerupCoords.ts';

describe('powerupCoords', () => {
  it('round-trips pixel positions via normalized fractions', () => {
    const worldW = 800;
    const worldH = 400;
    const { nx, ny } = normalizePowerupCoords(200, 100, worldW, worldH);
    assert.ok(Math.abs(nx - 0.25) < 1e-9);
    assert.ok(Math.abs(ny - 0.25) < 1e-9);
    assert.deepEqual(denormalizePowerupCoords(nx, ny, worldW, worldH), { x: 200, y: 100 });
  });

  it('denormalizes spawn payloads for the local world size', () => {
    const spawn = denormalizeArenaSpawn(
      { spawnId: 's1', powerupId: 'p1', nx: 0.5, ny: 0.25, r: 28 },
      1000,
      500,
    );
    assert.deepEqual(spawn, {
      spawnId: 's1',
      powerupId: 'p1',
      r: 28,
      x: 500,
      y: 125,
    });
  });
});
