import { Injectable } from '@nestjs/common';
import { AutomatedPerkGrantSource } from '../reward/player-reward-grant.service';
import { PushService } from '../push/push.service';
import { PrismaService } from '../prisma/prisma.service';

function sourceLabel(sourceType: AutomatedPerkGrantSource): string {
  switch (sourceType) {
    case 'TIER':
      return 'tier unlock';
    case 'PLATFORM_QUEST':
      return 'quest reward';
    case 'CHALLENGE':
      return 'challenge';
  }
}

@Injectable()
export class PlayerNotificationService {
  constructor(
    private readonly push: PushService,
    private readonly prisma: PrismaService,
  ) {}

  async notifyPerkGranted(params: {
    playerId: string;
    venueId: string;
    perkId: string;
    redemptionId: string;
    sourceType: AutomatedPerkGrantSource;
  }): Promise<void> {
    const [perk, venue] = await Promise.all([
      this.prisma.venuePerk.findUnique({
        where: { id: params.perkId },
        select: { title: true },
      }),
      this.prisma.venue.findUnique({
        where: { id: params.venueId },
        select: { name: true },
      }),
    ]);
    const perkTitle = perk?.title?.trim() || 'A perk';
    const venueName = venue?.name?.trim() || 'a partner venue';
    const via = sourceLabel(params.sourceType);

    void this.push.sendToPlayers(
      [params.playerId],
      undefined,
      {
        title: 'New perk unlocked',
        body: `${perkTitle} at ${venueName} (${via}). Open your wallet to redeem.`,
        channelId: 'partner_marketing',
        data: {
          kind: 'perk_granted',
          pushCategory: 'rewards',
          venueId: params.venueId,
          venueName,
          redemptionId: params.redemptionId,
          perkId: params.perkId,
        },
      },
      { channel: 'rewards' },
    );
  }

  async notifyReceiptReviewed(params: {
    playerId: string;
    venueId: string;
    submissionId: string;
    status: 'APPROVED' | 'REJECTED';
  }): Promise<void> {
    const venue = await this.prisma.venue.findUnique({
      where: { id: params.venueId },
      select: { name: true },
    });
    const venueName = venue?.name?.trim() || 'the venue';
    const approved = params.status === 'APPROVED';

    void this.push.sendToPlayers(
      [params.playerId],
      undefined,
      {
        title: approved ? 'Receipt approved' : 'Receipt update',
        body: approved
          ? `Your receipt at ${venueName} was approved. Thanks for visiting!`
          : `Your receipt at ${venueName} was reviewed. Open the app for details.`,
        channelId: 'partner_marketing',
        data: {
          kind: 'receipt_reviewed',
          pushCategory: 'rewards',
          venueId: params.venueId,
          venueName,
          submissionId: params.submissionId,
          status: params.status,
        },
      },
      { channel: 'rewards' },
    );
  }
}
