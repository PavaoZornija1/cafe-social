import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlatformRole } from '@prisma/client';
import { PartnerOrgAccessService } from './partner-org-access.service';
import { PARTNER_TRIAL_VENUES_LOCKED } from './partner-ops.events';

describe('PartnerOrgAccessService', () => {
  const future = new Date(Date.now() + 86400000);
  const past = new Date(Date.now() - 86400000);

  function makeService(prisma: {
    venueOrganization: { findUnique: jest.Mock };
    venue: { findUnique: jest.Mock; update: jest.Mock };
    player: { findFirst: jest.Mock };
  }) {
    const events = { emit: jest.fn() };
    const svc = new PartnerOrgAccessService(
      prisma as never,
      events as unknown as EventEmitter2,
    );
    return { svc, events };
  }

  describe('assertPartnerMayMutateOrganization', () => {
    it('allows super admin without hitting org', async () => {
      const prisma = {
        venueOrganization: { findUnique: jest.fn() },
        venue: { findUnique: jest.fn(), update: jest.fn() },
        player: {
          findFirst: jest.fn().mockResolvedValue({
            platformRole: PlatformRole.SUPER_ADMIN,
          }),
        },
      };
      const { svc } = makeService(prisma);
      await expect(
        svc.assertPartnerMayMutateOrganization('org-1', {
          email: 'admin@test.com',
        }),
      ).resolves.toBeUndefined();
      expect(prisma.venueOrganization.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFound when org missing', async () => {
      const prisma = {
        venueOrganization: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        venue: { findUnique: jest.fn(), update: jest.fn() },
        player: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const { svc } = makeService(prisma);
      await expect(
        svc.assertPartnerMayMutateOrganization('missing', { email: 'a@b.c' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Forbidden when trial ended and not paying', async () => {
      const prisma = {
        venueOrganization: {
          findUnique: jest.fn().mockResolvedValue({
            trialEndsAt: past,
            platformBillingStatus: 'NONE',
          }),
        },
        venue: { findUnique: jest.fn(), update: jest.fn() },
        player: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const { svc } = makeService(prisma);
      await expect(
        svc.assertPartnerMayMutateOrganization('org-1', { email: 'a@b.c' }),
      ).rejects.toEqual(expect.any(ForbiddenException));
    });

    it('allows when trial still active', async () => {
      const prisma = {
        venueOrganization: {
          findUnique: jest.fn().mockResolvedValue({
            trialEndsAt: future,
            platformBillingStatus: 'NONE',
          }),
        },
        venue: { findUnique: jest.fn(), update: jest.fn() },
        player: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const { svc } = makeService(prisma);
      await expect(
        svc.assertPartnerMayMutateOrganization('org-1', { email: 'a@b.c' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertPartnerMayMutateVenue', () => {
    it('throws Forbidden when venue locked', async () => {
      const prisma = {
        venueOrganization: { findUnique: jest.fn() },
        venue: {
          findUnique: jest.fn().mockResolvedValue({
            locked: true,
            lockReason: 'MANUAL',
            organization: { platformBillingStatus: 'ACTIVE', trialEndsAt: null },
          }),
          update: jest.fn(),
        },
        player: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const { svc } = makeService(prisma);
      await expect(
        svc.assertPartnerMayMutateVenue('venue-1', { email: 'a@b.c' }),
      ).rejects.toEqual(expect.any(ForbiddenException));
    });

    it('lets super admin bypass when not acting as partner venue', async () => {
      const prisma = {
        venueOrganization: { findUnique: jest.fn() },
        venue: {
          findUnique: jest.fn().mockResolvedValue({
            locked: true,
            lockReason: 'MANUAL',
            organization: { platformBillingStatus: 'ACTIVE', trialEndsAt: null },
          }),
          update: jest.fn(),
        },
        player: {
          findFirst: jest.fn().mockResolvedValue({
            platformRole: PlatformRole.SUPER_ADMIN,
          }),
        },
      };
      const { svc } = makeService(prisma);
      await expect(
        svc.assertPartnerMayMutateVenue('venue-1', { email: 'admin@test.com' }),
      ).resolves.toBeUndefined();
    });

    it('enforces locks for super admin acting as that venue', async () => {
      const prisma = {
        venueOrganization: { findUnique: jest.fn() },
        venue: {
          findUnique: jest.fn().mockResolvedValue({
            locked: true,
            lockReason: 'MANUAL',
            organization: { platformBillingStatus: 'ACTIVE', trialEndsAt: null },
          }),
          update: jest.fn(),
        },
        player: {
          findFirst: jest.fn().mockResolvedValue({
            platformRole: PlatformRole.SUPER_ADMIN,
          }),
        },
      };
      const { svc } = makeService(prisma);
      await expect(
        svc.assertPartnerMayMutateVenue(
          'venue-1',
          { email: 'admin@test.com' },
          { portalVenueContextHeader: 'venue-1' },
        ),
      ).rejects.toEqual(expect.any(ForbiddenException));
    });
  });

  describe('syncVenueLocksForOrganization', () => {
    it('emits event when venues are locked', async () => {
      const prisma = {
        venueOrganization: {
          findUnique: jest.fn().mockResolvedValue({
            platformBillingStatus: 'NONE',
            trialEndsAt: past,
            venues: [
              { id: 'v1', locked: false, lockReason: null },
              { id: 'v2', locked: true, lockReason: 'OTHER' },
            ],
          }),
        },
        venue: {
          findUnique: jest.fn(),
          update: jest.fn().mockResolvedValue({}),
        },
        player: { findFirst: jest.fn() },
      };
      const { svc, events } = makeService(prisma);
      await svc.syncVenueLocksForOrganization('org-1');
      expect(prisma.venue.update).toHaveBeenCalledTimes(1);
      expect(events.emit).toHaveBeenCalledWith(PARTNER_TRIAL_VENUES_LOCKED, {
        organizationId: 'org-1',
        venueIds: ['v1'],
      });
    });
  });
});
