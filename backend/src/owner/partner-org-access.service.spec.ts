import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PlatformRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PARTNER_TRIAL_LOCK_REASON } from './partner-access.constants';
import { PARTNER_TRIAL_VENUES_LOCKED } from './partner-ops.events';
import { PartnerOrgAccessService } from './partner-org-access.service';

describe('PartnerOrgAccessService', () => {
  let service: PartnerOrgAccessService;
  let prisma: {
    venueOrganization: { findUnique: jest.Mock };
    venue: { update: jest.Mock; updateMany: jest.Mock; findUnique: jest.Mock };
    player: { findFirst: jest.Mock };
  };
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      venueOrganization: { findUnique: jest.fn() },
      venue: { update: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
      player: { findFirst: jest.fn() },
    };
    events = { emit: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PartnerOrgAccessService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = moduleRef.get(PartnerOrgAccessService);
  });

  describe('syncVenueLocksForOrganizations', () => {
    it('dedupes ids, skips blanks, and logs when one org sync fails', async () => {
      const log = (service as unknown as { log: { warn: jest.Mock } }).log;
      const warnSpy = jest.spyOn(log, 'warn').mockImplementation(() => {});
      prisma.venueOrganization.findUnique
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValue(null);
      await service.syncVenueLocksForOrganizations(['o1', 'o1', '', 'o2']);
      expect(prisma.venueOrganization.findUnique).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('syncVenueLocksForOrganization failed for o1'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('syncVenueLocksForOrganization', () => {
    it('returns when organization is missing', async () => {
      prisma.venueOrganization.findUnique.mockResolvedValue(null);
      await service.syncVenueLocksForOrganization('org-missing');
      expect(prisma.venue.update).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('returns when trial not expired or org is paying', async () => {
      const future = new Date(Date.now() + 86400_000);
      prisma.venueOrganization.findUnique.mockResolvedValue({
        id: 'org1',
        platformBillingStatus: 'NONE',
        trialEndsAt: future,
        venues: [{ id: 'v1', locked: false, lockReason: null }],
      });
      await service.syncVenueLocksForOrganization('org1');
      expect(prisma.venue.update).not.toHaveBeenCalled();
    });

    it('locks venues when trial ended and not paying', async () => {
      const past = new Date(Date.now() - 86400_000);
      prisma.venueOrganization.findUnique.mockResolvedValue({
        id: 'org1',
        platformBillingStatus: 'NONE',
        trialEndsAt: past,
        venues: [
          { id: 'v1', locked: false, lockReason: null },
          { id: 'v2', locked: true, lockReason: 'MANUAL' },
        ],
      });
      prisma.venue.update.mockResolvedValue({});
      await service.syncVenueLocksForOrganization('org1');
      expect(prisma.venue.update).toHaveBeenCalledTimes(1);
      expect(prisma.venue.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { locked: true, lockReason: PARTNER_TRIAL_LOCK_REASON },
      });
      expect(events.emit).toHaveBeenCalledWith(PARTNER_TRIAL_VENUES_LOCKED, {
        organizationId: 'org1',
        venueIds: ['v1'],
      });
    });
  });

  describe('unlockTrialLockedVenuesForPaidOrganization', () => {
    it('no-ops when org not found', async () => {
      prisma.venueOrganization.findUnique.mockResolvedValue(null);
      await service.unlockTrialLockedVenuesForPaidOrganization('x');
      expect(prisma.venue.updateMany).not.toHaveBeenCalled();
    });

    it('no-ops when not paying', async () => {
      prisma.venueOrganization.findUnique.mockResolvedValue({
        platformBillingStatus: 'CANCELED',
      });
      await service.unlockTrialLockedVenuesForPaidOrganization('org1');
      expect(prisma.venue.updateMany).not.toHaveBeenCalled();
    });

    it('clears trial locks when paying', async () => {
      prisma.venueOrganization.findUnique.mockResolvedValue({
        platformBillingStatus: 'ACTIVE',
      });
      prisma.venue.updateMany.mockResolvedValue({ count: 2 });
      await service.unlockTrialLockedVenuesForPaidOrganization('org1');
      expect(prisma.venue.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org1',
          locked: true,
          lockReason: PARTNER_TRIAL_LOCK_REASON,
        },
        data: { locked: false, lockReason: null },
      });
    });
  });

  describe('assertPartnerMayMutateOrganization', () => {
    it('throws NotFoundException when organization missing', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.venueOrganization.findUnique.mockResolvedValue(null);
      await expect(
        service.assertPartnerMayMutateOrganization('missing-org', undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when trial ended and not paying', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.venueOrganization.findUnique.mockResolvedValue({
        trialEndsAt: new Date(Date.now() - 86_400_000),
        platformBillingStatus: 'NONE',
      });
      await expect(
        service.assertPartnerMayMutateOrganization('org1', undefined),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows super admin without org trial check', async () => {
      prisma.player.findFirst.mockResolvedValue({
        platformRole: PlatformRole.SUPER_ADMIN,
      });
      await expect(
        service.assertPartnerMayMutateOrganization('org1', { email: 'sa@example.com' }),
      ).resolves.toBeUndefined();
      expect(prisma.venueOrganization.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('assertPartnerMayMutateVenue', () => {
    it('returns early when super admin acts outside portal venue context', async () => {
      prisma.player.findFirst.mockResolvedValue({
        platformRole: PlatformRole.SUPER_ADMIN,
      });
      await service.assertPartnerMayMutateVenue('venue-1', { email: 'sa@x.com' }, {
        portalVenueContextHeader: 'other-venue',
      });
      expect(prisma.venue.findUnique).not.toHaveBeenCalled();
    });

    it('throws when venue is missing', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.venue.findUnique.mockResolvedValue(null);
      await expect(
        service.assertPartnerMayMutateVenue('missing', undefined),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when venue locked for trial expiry', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.venue.findUnique.mockResolvedValue({
        id: 'v1',
        locked: true,
        lockReason: PARTNER_TRIAL_LOCK_REASON,
        organization: { platformBillingStatus: 'NONE', trialEndsAt: null },
      });
      await expect(service.assertPartnerMayMutateVenue('v1', undefined)).rejects.toMatchObject({
        message: expect.stringContaining('not active on Cafe Social'),
      });
    });

    it('throws when venue locked for other reason', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.venue.findUnique.mockResolvedValue({
        id: 'v1',
        locked: true,
        lockReason: 'COMPLIANCE',
        organization: { platformBillingStatus: 'ACTIVE', trialEndsAt: null },
      });
      await expect(service.assertPartnerMayMutateVenue('v1', undefined)).rejects.toMatchObject({
        message: 'COMPLIANCE',
      });
    });

    it('throws when venue locked with empty reason uses default message', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.venue.findUnique.mockResolvedValue({
        id: 'v1',
        locked: true,
        lockReason: '   ',
        organization: { platformBillingStatus: 'ACTIVE', trialEndsAt: null },
      });
      await expect(service.assertPartnerMayMutateVenue('v1', undefined)).rejects.toMatchObject({
        message: 'This venue is locked — editing is disabled.',
      });
    });

    it('throws when org trial ended and not paying', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.venue.findUnique.mockResolvedValue({
        id: 'v1',
        locked: false,
        lockReason: null,
        organization: {
          platformBillingStatus: 'NONE',
          trialEndsAt: new Date(Date.now() - 86400000),
        },
      });
      await expect(service.assertPartnerMayMutateVenue('v1', undefined)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('resolves for unlocked venue with no trial issue', async () => {
      prisma.player.findFirst.mockResolvedValue(null);
      prisma.venue.findUnique.mockResolvedValue({
        id: 'v1',
        locked: false,
        lockReason: null,
        organization: {
          platformBillingStatus: 'ACTIVE',
          trialEndsAt: new Date(Date.now() + 86400000),
        },
      });
      await expect(service.assertPartnerMayMutateVenue('v1', undefined)).resolves.toBeUndefined();
    });
  });
});
