import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CampaignStatus, Prisma } from '@prisma/client';
import { PushService } from '../push/push.service';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerCampaignService } from './owner-campaign.service';

describe('OwnerCampaignService', () => {
  let service: OwnerCampaignService;
  let prisma: {
    venueCampaign: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    venueCampaignBinding: {
      findMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
    };
    challenge: { findFirst: jest.Mock };
    venuePerk: { findFirst: jest.Mock };
    venueOffer: { findFirst: jest.Mock };
    venueCampaignSend: { deleteMany: jest.Mock; createMany: jest.Mock };
    playerVenueVisitDay: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      venueCampaign: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      venueCampaignBinding: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      challenge: { findFirst: jest.fn() },
      venuePerk: { findFirst: jest.fn() },
      venueOffer: { findFirst: jest.fn() },
      venueCampaignSend: { deleteMany: jest.fn(), createMany: jest.fn() },
      playerVenueVisitDay: { findMany: jest.fn() },
    };

    const push = { sendToPlayers: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OwnerCampaignService,
        { provide: PrismaService, useValue: prisma },
        { provide: PushService, useValue: push },
      ],
    }).compile();
    service = moduleRef.get(OwnerCampaignService);
  });

  describe('list', () => {
    it('delegates to prisma with venue filter', async () => {
      const rows = [{ id: 'c1' }];
      prisma.venueCampaign.findMany.mockResolvedValue(rows);
      const out = await service.list('v1');
      expect(out).toBe(rows);
      expect(prisma.venueCampaign.findMany).toHaveBeenCalledWith({
        where: { venueId: 'v1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('create', () => {
    it('clamps segmentDays to 1–365', async () => {
      prisma.venueCampaign.create.mockResolvedValue({ id: 'c1' });
      await service.create({
        venueId: 'v1',
        name: ' n ',
        title: ' t ',
        body: ' b ',
        segmentDays: 9999,
      });
      expect(prisma.venueCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ segmentDays: 365 }),
        }),
      );
      await service.create({
        venueId: 'v1',
        name: 'n',
        title: 't',
        body: 'b',
        segmentDays: 0,
      });
      expect(prisma.venueCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ segmentDays: 1 }),
        }),
      );
    });
  });

  describe('listBindings', () => {
    it('throws when campaign is not in venue', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue(null);
      await expect(service.listBindings('v1', 'c1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns bindings ordered', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({ id: 'c1' });
      const rows = [{ id: 'b1', campaignId: 'c1' }];
      prisma.venueCampaignBinding.findMany.mockResolvedValue(rows);
      const out = await service.listBindings('v1', 'c1');
      expect(out).toEqual(rows);
      expect(prisma.venueCampaignBinding.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('addBinding', () => {
    it('throws BadRequestException for unknown entityType', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({ id: 'c1' });
      await expect(
        service.addBinding('v1', 'c1', 'OTHER', '00000000-0000-4000-8000-000000000001'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when challenge missing for venue', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.challenge.findFirst.mockResolvedValue(null);
      await expect(
        service.addBinding('v1', 'c1', 'CHALLENGE', '00000000-0000-4000-8000-000000000001'),
      ).rejects.toMatchObject({ message: 'Challenge not found for this venue' });
    });

    it('creates binding for CHALLENGE when challenge exists', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.challenge.findFirst.mockResolvedValue({ id: 'ch1' });
      const created = { id: 'bind-ch', entityType: 'CHALLENGE', entityId: 'ch1' };
      prisma.venueCampaignBinding.create.mockResolvedValue(created);
      const out = await service.addBinding(
        'v1',
        'c1',
        'CHALLENGE',
        '00000000-0000-4000-8000-0000000000cc',
      );
      expect(out).toEqual(created);
    });

    it('throws when offer missing for venue', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.venueOffer.findFirst.mockResolvedValue(null);
      await expect(
        service.addBinding('v1', 'c1', 'VENUE_OFFER', '00000000-0000-4000-8000-0000000000dd'),
      ).rejects.toMatchObject({ message: 'Offer not found for this venue' });
    });

    it('throws when perk missing for venue', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.venuePerk.findFirst.mockResolvedValue(null);
      await expect(
        service.addBinding('v1', 'c1', 'VENUE_PERK', '00000000-0000-4000-8000-000000000001'),
      ).rejects.toMatchObject({ message: 'Perk not found for this venue' });
    });

    it('rethrows non-unique Prisma errors from create', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.venuePerk.findFirst.mockResolvedValue({ id: 'p1' });
      prisma.venueCampaignBinding.create.mockRejectedValue(new Error('connection reset'));
      await expect(
        service.addBinding('v1', 'c1', 'VENUE_PERK', '00000000-0000-4000-8000-0000000000aa'),
      ).rejects.toThrow('connection reset');
    });

    it('creates binding when entity exists', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.venuePerk.findFirst.mockResolvedValue({ id: 'p1' });
      const created = { id: 'bind1', entityType: 'VENUE_PERK', entityId: 'p1' };
      prisma.venueCampaignBinding.create.mockResolvedValue(created);
      const out = await service.addBinding('v1', 'c1', 'VENUE_PERK', '00000000-0000-4000-8000-0000000000aa');
      expect(out).toEqual(created);
    });

    it('maps Prisma P2002 to ConflictException', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.venueOffer.findFirst.mockResolvedValue({ id: 'o1' });
      const err = new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { modelName: 'VenueCampaignBinding' },
      });
      prisma.venueCampaignBinding.create.mockRejectedValue(err);
      await expect(
        service.addBinding('v1', 'c1', 'VENUE_OFFER', '00000000-0000-4000-8000-0000000000bb'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('removeBinding', () => {
    it('throws NotFoundException when binding row missing', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.venueCampaignBinding.findFirst.mockResolvedValue(null);
      await expect(
        service.removeBinding('v1', 'c1', '00000000-0000-4000-8000-000000000001'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deletes binding', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({ id: 'c1' });
      prisma.venueCampaignBinding.findFirst.mockResolvedValue({ id: 'b1' });
      prisma.venueCampaignBinding.delete.mockResolvedValue({});
      const out = await service.removeBinding('v1', 'c1', '00000000-0000-4000-8000-000000000002');
      expect(out).toEqual({ ok: true });
      expect(prisma.venueCampaignBinding.delete).toHaveBeenCalledWith({
        where: { id: '00000000-0000-4000-8000-000000000002' },
      });
    });
  });

  describe('send', () => {
    it('throws NotFoundException when campaign missing', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue(null);
      await expect(service.send('v1', 'c1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when campaign already completed', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({
        id: 'c1',
        venueId: 'v1',
        status: CampaignStatus.COMPLETED,
      });
      await expect(service.send('v1', 'c1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when campaign is in SENDING state', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({
        id: 'c1',
        venueId: 'v1',
        status: CampaignStatus.SENDING,
        segmentDays: 7,
      });
      await expect(service.send('v1', 'c1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('deletes prior sends when retrying a FAILED campaign', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({
        id: 'c1',
        venueId: 'v1',
        status: CampaignStatus.FAILED,
        segmentDays: 7,
        title: 'Hi',
        body: 'There',
      });
      prisma.playerVenueVisitDay.findMany.mockResolvedValue([]);
      prisma.venueCampaign.update
        .mockResolvedValueOnce({ id: 'c1', status: CampaignStatus.SENDING })
        .mockResolvedValueOnce({ id: 'c1', status: CampaignStatus.COMPLETED });
      const push = { sendToPlayers: jest.fn().mockResolvedValue(undefined) };
      const mod = await Test.createTestingModule({
        providers: [
          OwnerCampaignService,
          { provide: PrismaService, useValue: prisma },
          { provide: PushService, useValue: push },
        ],
      }).compile();
      await mod.get(OwnerCampaignService).send('v1', 'c1');
      expect(prisma.venueCampaignSend.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1' },
      });
    });

    it('completes send with zero recipients without createMany', async () => {
      const campaign = {
        id: 'c1',
        venueId: 'v1',
        status: CampaignStatus.DRAFT,
        segmentDays: 7,
        title: 'T',
        body: 'B',
      };
      prisma.venueCampaign.findFirst.mockResolvedValue(campaign);
      prisma.playerVenueVisitDay.findMany.mockResolvedValue([]);
      prisma.venueCampaign.update
        .mockResolvedValueOnce({ ...campaign, status: CampaignStatus.SENDING })
        .mockResolvedValueOnce({ ...campaign, status: CampaignStatus.COMPLETED });
      const push = { sendToPlayers: jest.fn().mockResolvedValue(undefined) };
      const mod = await Test.createTestingModule({
        providers: [
          OwnerCampaignService,
          { provide: PrismaService, useValue: prisma },
          { provide: PushService, useValue: push },
        ],
      }).compile();
      await mod.get(OwnerCampaignService).send('v1', 'c1');
      expect(prisma.venueCampaignSend.createMany).not.toHaveBeenCalled();
      expect(push.sendToPlayers).toHaveBeenCalledWith(
        [],
        undefined,
        expect.any(Object),
        { channel: 'partner_marketing' },
      );
    });

    it('completes send for DRAFT campaign with recipients', async () => {
      const campaign = {
        id: 'c1',
        venueId: 'v1',
        status: CampaignStatus.DRAFT,
        segmentDays: 14,
        title: 'Title',
        body: 'Body',
      };
      prisma.venueCampaign.findFirst.mockResolvedValue(campaign);
      prisma.playerVenueVisitDay.findMany.mockResolvedValue([
        { playerId: 'p1' },
        { playerId: 'p2' },
      ]);
      prisma.venueCampaign.update
        .mockResolvedValueOnce({ ...campaign, status: CampaignStatus.SENDING })
        .mockResolvedValueOnce({ ...campaign, status: CampaignStatus.COMPLETED });
      prisma.venueCampaignSend.createMany.mockResolvedValue({ count: 2 });
      const push = { sendToPlayers: jest.fn().mockResolvedValue(undefined) };
      const mod = await Test.createTestingModule({
        providers: [
          OwnerCampaignService,
          { provide: PrismaService, useValue: prisma },
          { provide: PushService, useValue: push },
        ],
      }).compile();
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
      const done = await mod.get(OwnerCampaignService).send('v1', 'c1');
      jest.useRealTimers();
      expect(done.status).toBe(CampaignStatus.COMPLETED);
      expect(push.sendToPlayers).toHaveBeenCalledWith(
        ['p1', 'p2'],
        undefined,
        expect.objectContaining({
          title: 'Title',
          body: 'Body',
          data: expect.objectContaining({
            pushCategory: 'partner_marketing',
            venueId: 'v1',
            campaignId: 'c1',
          }),
        }),
        { channel: 'partner_marketing' },
      );
      expect(prisma.venueCampaignSend.createMany).toHaveBeenCalled();
    });

    it('marks campaign FAILED when push throws', async () => {
      prisma.venueCampaign.findFirst.mockResolvedValue({
        id: 'c1',
        venueId: 'v1',
        status: CampaignStatus.DRAFT,
        segmentDays: 7,
        title: 'T',
        body: 'B',
      });
      prisma.playerVenueVisitDay.findMany.mockResolvedValue([{ playerId: 'p1' }]);
      prisma.venueCampaign.update.mockResolvedValue({});
      const push = { sendToPlayers: jest.fn().mockRejectedValue(new Error('push down')) };
      const mod = await Test.createTestingModule({
        providers: [
          OwnerCampaignService,
          { provide: PrismaService, useValue: prisma },
          { provide: PushService, useValue: push },
        ],
      }).compile();
      await expect(mod.get(OwnerCampaignService).send('v1', 'c1')).rejects.toThrow('push down');
      expect(prisma.venueCampaign.update).toHaveBeenLastCalledWith({
        where: { id: 'c1' },
        data: { status: CampaignStatus.FAILED, lastError: 'push down' },
      });
    });
  });
});
