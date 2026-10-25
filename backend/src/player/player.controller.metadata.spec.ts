jest.mock('./player.service', () => ({ PlayerService: class PlayerService {} }));
jest.mock('../auth/jwt-validation.service', () => ({ JwtValidationService: class JwtValidationService {} }));
jest.mock('../venue/venue-moderation.service', () => ({ VenueModerationService: class VenueModerationService {} }));

import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlayerController } from './player.controller';

describe('player HTTP access', () => {
  it('requires a JWT for the entire controller, including future routes', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PlayerController)).toContain(JwtAuthGuard);
  });

  it('only exposes routes scoped to the signed-in player', () => {
    const routes = Object.getOwnPropertyNames(PlayerController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => Reflect.getMetadata(PATH_METADATA, PlayerController.prototype[name as keyof PlayerController] as object))
      .filter((path): path is string => path !== undefined);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((path) => path === 'me' || path.startsWith('me/'))).toBe(true);
  });
});
