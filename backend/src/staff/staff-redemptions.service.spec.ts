import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StaffRedemptionsService } from './staff-redemptions.service';

function mockRedemptionRow(overrides: Record<string, unknown> = {}) {
  const issued = new Date('2026-04-29T10:00:00.000Z');
  const expires = new Date('2026-05-01T00:00:00.000Z');
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-111111111111',
    issuedAt: issued,
    redeemedAt: null,
    expiresAt: expires,
    status: 'REDEEMABLE',
    voidedAt: null,
    voidReason: null,
    perk: { code: 'COFFEE', title: 'Free coffee' },
    ...overrides,
  };
}

describe('StaffRedemptionsService', () => {
  let service: StaffRedemptionsService;
  let prisma: {
    venue: { findUnique: jest.Mock };
    venuePerkRedemption: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      venue: { findUnique: jest.fn() },
      venuePerkRedemption: { findMany: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StaffRedemptionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(StaffRedemptionsService);
  });

  it('throws NotFoundException when venue is missing', async () => {
    prisma.venue.findUnique.mockResolvedValue(null);
    await expect(
      service.listRedemptionsForStaffUser('vid', '2026-04-29'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException for invalid date', async () => {
    prisma.venue.findUnique.mockResolvedValue({ id: 'vid', name: 'Cafe' });
    await expect(
      service.listRedemptionsForStaffUser('vid', 'not-a-date'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps VOIDED when voidedAt is set', async () => {
    prisma.venue.findUnique.mockResolvedValue({ id: 'vid', name: 'Cafe' });
    prisma.venuePerkRedemption.findMany.mockResolvedValue([
      mockRedemptionRow({
        voidedAt: new Date('2026-04-29T11:00:00.000Z'),
        voidReason: 'mistake',
      }),
    ]);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    const out = await service.listRedemptionsForStaffUser('vid', '2026-04-29');
    jest.useRealTimers();
    expect(out.redemptions[0].status).toBe('VOIDED');
    expect(out.redemptions[0].voidReason).toBe('mistake');
  });

  it('maps EXPIRED when REDEEMABLE and expiresAt is in the past', async () => {
    prisma.venue.findUnique.mockResolvedValue({ id: 'vid', name: 'Cafe' });
    prisma.venuePerkRedemption.findMany.mockResolvedValue([
      mockRedemptionRow({
        expiresAt: new Date('2026-04-28T23:59:59.000Z'),
      }),
    ]);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    const out = await service.listRedemptionsForStaffUser('vid', '2026-04-29');
    jest.useRealTimers();
    expect(out.redemptions[0].status).toBe('EXPIRED');
  });

  it('passes through DB status when still redeemable and not expired', async () => {
    prisma.venue.findUnique.mockResolvedValue({ id: 'vid', name: 'Cafe' });
    prisma.venuePerkRedemption.findMany.mockResolvedValue([mockRedemptionRow()]);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-29T12:00:00.000Z'));
    const out = await service.listRedemptionsForStaffUser('vid', '2026-04-29');
    jest.useRealTimers();
    expect(out.redemptions[0].status).toBe('REDEEMABLE');
    expect(out.venueName).toBe('Cafe');
    expect(out.date).toBe('2026-04-29');
  });

  it('queries redemptions by issuedAt within the UTC calendar day', async () => {
    prisma.venue.findUnique.mockResolvedValue({ id: 'vid', name: 'Cafe' });
    prisma.venuePerkRedemption.findMany.mockResolvedValue([]);
    await service.listRedemptionsForStaffUser('vid', '2026-07-20');
    expect(prisma.venuePerkRedemption.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          venueId: 'vid',
          issuedAt: {
            gte: new Date(Date.UTC(2026, 6, 20, 0, 0, 0, 0)),
            lte: new Date(Date.UTC(2026, 6, 20, 23, 59, 59, 999)),
          },
        },
        orderBy: { issuedAt: 'desc' },
      }),
    );
  });
});
