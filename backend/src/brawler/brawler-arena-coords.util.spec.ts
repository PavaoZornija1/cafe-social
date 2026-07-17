import {
  denormalizePowerupCoords,
  normalizePowerupCoords,
} from './brawler-arena-coords.util';

describe('brawler-arena-coords.util', () => {
  it('normalizes and denormalizes consistently', () => {
    const { nx, ny } = normalizePowerupCoords(160, 80, 640, 320);
    expect(nx).toBeCloseTo(0.25);
    expect(ny).toBeCloseTo(0.25);
    expect(denormalizePowerupCoords(nx, ny, 640, 320)).toEqual({ x: 160, y: 80 });
  });
});
