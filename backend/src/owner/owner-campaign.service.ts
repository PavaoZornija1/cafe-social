import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';

function utcDayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class OwnerCampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  list(venueId: string) {
    return this.prisma.venueCampaign.findMany({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async create(params: {
    venueId: string;
    name: string;
    title: string;
    body: string;
    segmentDays: number;
  }) {
    const seg = Math.min(Math.max(params.segmentDays, 1), 365);
    return this.prisma.venueCampaign.create({
      data: {
        venueId: params.venueId,
        name: params.name.trim(),
        title: params.title.trim(),
        body: params.body.trim(),
        segmentDays: seg,
        status: CampaignStatus.DRAFT,
      },
    });
  }

  async send(venueId: string, campaignId: string) {
    const campaign = await this.prisma.venueCampaign.findFirst({
      where: { id: campaignId, venueId },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new BadRequestException('This campaign was already sent');
    }
    if (
      campaign.status !== CampaignStatus.DRAFT &&
      campaign.status !== CampaignStatus.FAILED
    ) {
      throw new BadRequestException('Campaign cannot be sent in this state');
    }
    if (campaign.status === CampaignStatus.FAILED) {
      await this.prisma.venueCampaignSend.deleteMany({
        where: { campaignId: campaign.id },
      });
    }

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - campaign.segmentDays);
    const cutoffKey = utcDayKey(cutoff);

    const visitRows = await this.prisma.playerVenueVisitDay.findMany({
      where: { venueId, dayKey: { gte: cutoffKey } },
      distinct: ['playerId'],
      select: { playerId: true },
    });
    const playerIds = visitRows.map((r) => r.playerId);

    await this.prisma.venueCampaign.update({
      where: { id: campaign.id },
      data: {
        status: CampaignStatus.SENDING,
        recipientCount: playerIds.length,
        lastError: null,
      },
    });

    try {
      await this.push.sendToPlayers(
        playerIds,
        undefined,
        {
          title: campaign.title,
          body: campaign.body,
          data: {
            pushCategory: 'partner_marketing',
            venueId: campaign.venueId,
            campaignId: campaign.id,
          },
        },
        { channel: 'partner_marketing' },
      );

      if (playerIds.length > 0) {
        await this.prisma.venueCampaignSend.createMany({
          data: playerIds.map((playerId) => ({
            campaignId: campaign.id,
            playerId,
            ok: true,
          })),
        });
      }

      return this.prisma.venueCampaign.update({
        where: { id: campaign.id },
        data: {
          status: CampaignStatus.COMPLETED,
          sentAt: new Date(),
          pushSentCount: playerIds.length,
        },
      });
    } catch (e) {
      const msg = (e as Error).message?.slice(0, 500) ?? 'send failed';
      await this.prisma.venueCampaign.update({
        where: { id: campaign.id },
        data: { status: CampaignStatus.FAILED, lastError: msg },
      });
      throw e;
    }
  }

  private async assertCampaignInVenue(venueId: string, campaignId: string) {
    const c = await this.prisma.venueCampaign.findFirst({
      where: { id: campaignId, venueId },
    });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  private async assertBindingEntityInVenue(
    venueId: string,
    entityType: string,
    entityId: string,
  ) {
    switch (entityType) {
      case 'CHALLENGE': {
        const row = await this.prisma.challenge.findFirst({
          where: { id: entityId, venueId },
        });
        if (!row) throw new BadRequestException('Challenge not found for this venue');
        break;
      }
      case 'VENUE_PERK': {
        const row = await this.prisma.venuePerk.findFirst({
          where: { id: entityId, venueId },
        });
        if (!row) throw new BadRequestException('Perk not found for this venue');
        break;
      }
      case 'VENUE_OFFER': {
        const row = await this.prisma.venueOffer.findFirst({
          where: { id: entityId, venueId },
        });
        if (!row) throw new BadRequestException('Offer not found for this venue');
        break;
      }
      default:
        throw new BadRequestException('Unknown entityType');
    }
  }

  async listBindings(venueId: string, campaignId: string) {
    await this.assertCampaignInVenue(venueId, campaignId);
    return this.prisma.venueCampaignBinding.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addBinding(
    venueId: string,
    campaignId: string,
    entityType: string,
    entityId: string,
  ) {
    await this.assertCampaignInVenue(venueId, campaignId);
    const et = entityType.trim();
    const eid = entityId.trim();
    await this.assertBindingEntityInVenue(venueId, et, eid);
    try {
      return await this.prisma.venueCampaignBinding.create({
        data: { campaignId, entityType: et, entityId: eid },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('This binding already exists');
      }
      throw e;
    }
  }

  async removeBinding(venueId: string, campaignId: string, bindingId: string) {
    await this.assertCampaignInVenue(venueId, campaignId);
    const row = await this.prisma.venueCampaignBinding.findFirst({
      where: { id: bindingId, campaignId },
    });
    if (!row) throw new NotFoundException('Binding not found');
    await this.prisma.venueCampaignBinding.delete({ where: { id: bindingId } });
    return { ok: true };
  }
}
