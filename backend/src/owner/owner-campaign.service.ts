import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus } from '@prisma/client';
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
}
