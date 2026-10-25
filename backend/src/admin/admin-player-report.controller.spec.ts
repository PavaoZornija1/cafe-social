jest.mock('../player/player.service', () => ({
  PlayerService: class PlayerService {},
}));
jest.mock('../auth/jwt-validation.service', () => ({
  JwtValidationService: class JwtValidationService {},
}));
jest.mock('../venue/venue-moderation.service', () => ({
  VenueModerationService: class VenueModerationService {},
}));
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';
import { AdminPlayerReportController } from './admin-player-report.controller';

describe('platform moderation authorization', () => {
  it('requires authentication and the database-backed super admin guard for every route', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminPlayerReportController),
    ).toEqual([JwtAuthGuard, PlatformSuperAdminGuard]);
  });
  it('denies a regular player even if their claims assert an admin role', async () => {
    const guard = new PlatformSuperAdminGuard({
      player: {
        findFirst: jest.fn().mockResolvedValue({ platformRole: 'NONE' }),
      },
    } as never);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            email: 'viewer@example.test',
            claims: { platformRole: 'SUPER_ADMIN' },
          },
        }),
      }),
    } as ExecutionContext;
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
