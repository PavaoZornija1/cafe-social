jest.mock('../player/player.service', () => ({ PlayerService: class PlayerService {} }));

import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { VenueStaffRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerService } from '../player/player.service';
import { VenueStaffService } from '../venue-staff/venue-staff.service';
import { AdminCmsAccessService, type AdminCmsScope } from './admin-cms-access.service';
import { AdminCmsGuard } from './admin-cms.guard';
import { AdminVenueStaffController } from './admin-venue-staff.controller';

const VENUE_ID = '2f9f7a10-8a5e-4c47-9f6c-0a4a9a1b2c3d';
const PLAYER_ID = '7c1d2e30-4b5a-4c6d-8e9f-0a1b2c3d4e5f';

type ReqWithScope = { adminCmsScope?: AdminCmsScope };

const superAdminReq = (): ReqWithScope => ({ adminCmsScope: { kind: 'super_admin' } });
const partnerReq = (): ReqWithScope => ({
  adminCmsScope: {
    kind: 'partner',
    playerId: 'partner-player',
    managedVenueIds: [VENUE_ID],
  },
});

describe('AdminVenueStaffController', () => {
  let controller: AdminVenueStaffController;
  let prisma: { venue: { findUnique: jest.Mock } };
  let venueStaff: {
    listStaffForVenue: jest.Mock;
    findMembership: jest.Mock;
    upsertMember: jest.Mock;
    removeMember: jest.Mock;
    assertCanRemoveOrDemoteOwner: jest.Mock;
  };
  let players: { findOrCreateByEmail: jest.Mock };

  beforeEach(async () => {
    prisma = {
      venue: {
        findUnique: jest.fn().mockResolvedValue({
          locked: false,
          lockReason: null,
          organization: null,
        }),
      },
    };
    venueStaff = {
      listStaffForVenue: jest.fn().mockResolvedValue([]),
      findMembership: jest.fn().mockResolvedValue(null),
      upsertMember: jest.fn().mockResolvedValue({ id: 'vs1' }),
      removeMember: jest.fn().mockResolvedValue(undefined),
      assertCanRemoveOrDemoteOwner: jest.fn().mockResolvedValue(undefined),
    };
    players = {
      findOrCreateByEmail: jest.fn().mockResolvedValue({ id: PLAYER_ID }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminVenueStaffController],
      providers: [
        AdminCmsAccessService,
        { provide: PrismaService, useValue: prisma },
        { provide: VenueStaffService, useValue: venueStaff },
        { provide: PlayerService, useValue: players },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminCmsGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = moduleRef.get(AdminVenueStaffController);
  });

  it('rejects partner (manager/owner) scope on direct staff upsert', async () => {
    await expect(
      controller.upsert(partnerReq() as never, VENUE_ID, {
        email: 'new@staff.com',
        role: VenueStaffRole.EMPLOYEE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(venueStaff.upsertMember).not.toHaveBeenCalled();
    expect(players.findOrCreateByEmail).not.toHaveBeenCalled();
  });

  it('rejects partner scope on direct staff removal', async () => {
    await expect(
      controller.remove(partnerReq() as never, VENUE_ID, PLAYER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(venueStaff.removeMember).not.toHaveBeenCalled();
  });

  it('allows super admin to upsert staff', async () => {
    await controller.upsert(superAdminReq() as never, VENUE_ID, {
      email: 'new@staff.com',
      role: VenueStaffRole.MANAGER,
    });
    expect(venueStaff.upsertMember).toHaveBeenCalledWith({
      venueId: VENUE_ID,
      playerId: PLAYER_ID,
      role: VenueStaffRole.MANAGER,
    });
  });

  it('allows super admin to remove staff', async () => {
    await expect(
      controller.remove(superAdminReq() as never, VENUE_ID, PLAYER_ID),
    ).resolves.toEqual({ ok: true });
    expect(venueStaff.removeMember).toHaveBeenCalledWith(VENUE_ID, PLAYER_ID);
  });

  it('keeps staff list readable for partner scope on their own venue', async () => {
    await controller.list(partnerReq() as never, VENUE_ID);
    expect(venueStaff.listStaffForVenue).toHaveBeenCalledWith(VENUE_ID);
  });

  it('still rejects partner reads outside their venue scope', async () => {
    const req: ReqWithScope = {
      adminCmsScope: {
        kind: 'partner',
        playerId: 'partner-player',
        managedVenueIds: ['00000000-0000-4000-8000-000000000000'],
      },
    };
    expect(() => controller.list(req as never, VENUE_ID)).toThrow(ForbiddenException);
  });
});
