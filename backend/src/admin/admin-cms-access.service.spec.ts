import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PARTNER_TRIAL_LOCK_REASON } from '../owner/partner-access.constants';
import {
  AdminCmsAccessService,
  type AdminCmsScope,
} from './admin-cms-access.service';

describe('AdminCmsAccessService.assertVenueMutable', () => {
  let service: AdminCmsAccessService;
  let prisma: { venue: { findUnique: jest.Mock } };

  const superAdminScope: AdminCmsScope = { kind: 'super_admin' };
  const partnerScope: AdminCmsScope = {
    kind: 'partner',
    playerId: 'p1',
    managedVenueIds: ['v1'],
  };

  beforeEach(async () => {
    prisma = { venue: { findUnique: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminCmsAccessService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AdminCmsAccessService);
  });

  it('bypasses the check for super admins without touching the db', async () => {
    await expect(
      service.assertVenueMutable(superAdminScope, 'v1'),
    ).resolves.toBeUndefined();
    expect(prisma.venue.findUnique).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the venue is missing', async () => {
    prisma.venue.findUnique.mockResolvedValue(null);
    await expect(
      service.assertVenueMutable(partnerScope, 'v1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks partner writes when the venue is trial-locked', async () => {
    prisma.venue.findUnique.mockResolvedValue({
      locked: true,
      lockReason: PARTNER_TRIAL_LOCK_REASON,
      organization: { platformBillingStatus: 'NONE', trialEndsAt: null },
    });
    await expect(
      service.assertVenueMutable(partnerScope, 'v1'),
    ).rejects.toMatchObject({
      message: expect.stringContaining('not active on Cafe Social'),
    });
  });

  it('surfaces a custom lock reason', async () => {
    prisma.venue.findUnique.mockResolvedValue({
      locked: true,
      lockReason: 'COMPLIANCE',
      organization: { platformBillingStatus: 'ACTIVE', trialEndsAt: null },
    });
    await expect(
      service.assertVenueMutable(partnerScope, 'v1'),
    ).rejects.toMatchObject({ message: 'COMPLIANCE' });
  });

  it('blocks partner writes when the org trial ended without payment', async () => {
    prisma.venue.findUnique.mockResolvedValue({
      locked: false,
      lockReason: null,
      organization: {
        platformBillingStatus: 'NONE',
        trialEndsAt: new Date(Date.now() - 86_400_000),
      },
    });
    await expect(
      service.assertVenueMutable(partnerScope, 'v1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows partner writes for an unlocked venue with an active subscription', async () => {
    prisma.venue.findUnique.mockResolvedValue({
      locked: false,
      lockReason: null,
      organization: {
        platformBillingStatus: 'ACTIVE',
        trialEndsAt: new Date(Date.now() - 86_400_000),
      },
    });
    await expect(
      service.assertVenueMutable(partnerScope, 'v1'),
    ).resolves.toBeUndefined();
  });

  it('allows partner writes during an active trial', async () => {
    prisma.venue.findUnique.mockResolvedValue({
      locked: false,
      lockReason: null,
      organization: {
        platformBillingStatus: 'NONE',
        trialEndsAt: new Date(Date.now() + 86_400_000),
      },
    });
    await expect(
      service.assertVenueMutable(partnerScope, 'v1'),
    ).resolves.toBeUndefined();
  });
});
