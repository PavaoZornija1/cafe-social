import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerRedemptionActionsService } from './owner-redemption-actions.service';

describe('OwnerRedemptionActionsService', () => {
  let service: OwnerRedemptionActionsService;
  let prisma: {
    venuePerkRedemption: {
      findFirst: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      venuePerkRedemption: {
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OwnerRedemptionActionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(OwnerRedemptionActionsService);
  });

  it('blocks self-acknowledge', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      playerId: 'guest-1',
      status: 'REDEEMABLE',
      voidedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      redeemedAt: null,
    });
    await expect(
      service.acknowledge({
        venueId: 'v1',
        redemptionId: 'r1',
        staffPlayerId: 'guest-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks acknowledge when status is LOCKED', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      status: 'LOCKED',
      voidedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      redeemedAt: null,
    });
    await expect(
      service.acknowledge({
        venueId: 'v1',
        redemptionId: 'r1',
        staffPlayerId: 'staff-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locks without staff audit id when staffPlayerId omitted', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      status: 'REDEEMABLE',
    });
    prisma.venuePerkRedemption.update.mockResolvedValue({ id: 'r1', status: 'LOCKED' });
    await service.lockRedemption({
      venueId: 'v1',
      redemptionId: 'r1',
      reason: 'Receipt submitted',
    });
    expect(prisma.venuePerkRedemption.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        status: 'LOCKED',
        voidReason: 'Receipt submitted',
        voidedByPlayerId: null,
      },
    });
  });

  it('unlock clears lock audit fields', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue({
      id: 'r1',
      status: 'LOCKED',
    });
    prisma.venuePerkRedemption.update.mockResolvedValue({ id: 'r1', status: 'REDEEMABLE' });
    await service.unlockRedemption({ venueId: 'v1', redemptionId: 'r1' });
    expect(prisma.venuePerkRedemption.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: {
        status: 'REDEEMABLE',
        voidReason: null,
        voidedByPlayerId: null,
      },
    });
  });

  it('throws NotFound when redemption missing on void', async () => {
    prisma.venuePerkRedemption.findFirst.mockResolvedValue(null);
    await expect(
      service.voidRedemption({
        venueId: 'v1',
        redemptionId: 'missing',
        staffPlayerId: 'staff-1',
        reason: 'abuse',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
