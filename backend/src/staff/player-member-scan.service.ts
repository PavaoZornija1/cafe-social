import { Injectable, NotFoundException } from '@nestjs/common';
import { DiscoveryService } from '../social/discovery.service';
import { utcDayKey } from '../lib/day-key';
import { parseMemberTokenFromQr } from '../lib/member-card-qr';
import { PrismaService } from '../prisma/prisma.service';
import { VenueFunnelService } from '../venue/venue-funnel.service';
import { VenueModerationService } from '../venue/venue-moderation.service';
import { PlayerVenueCheckInRepository } from '../venue/player-venue-check-in.repository';
import { PlayerVenueRepository } from '../venue/player-venue.repository';
import { ChallengeService } from '../challenge/challenge.service';

@Injectable()
export class PlayerMemberScanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moderation: VenueModerationService,
    private readonly playerVenues: PlayerVenueRepository,
    private readonly explicitCheckIns: PlayerVenueCheckInRepository,
    private readonly funnel: VenueFunnelService,
    private readonly discovery: DiscoveryService,
    private readonly challenges: ChallengeService,
  ) {}

  /**
   * Staff scans a guest's personal member QR at a venue — records today's visit and check-in.
   */
  async scanMemberCardAtVenue(params: {
    venueId: string;
    qrPayload: string;
  }): Promise<{
    playerId: string;
    username: string;
    visitDayKey: string;
  }> {
    const memberToken = parseMemberTokenFromQr(params.qrPayload);
    if (!memberToken) {
      throw new NotFoundException('Unrecognized member card');
    }

    const venue = await this.prisma.venue.findUnique({
      where: { id: params.venueId },
      select: { id: true, locked: true, requiresExplicitCheckIn: true },
    });
    if (!venue || venue.locked) {
      throw new NotFoundException('Venue not found');
    }

    const player = await this.prisma.player.findUnique({
      where: { memberQrToken: memberToken },
      select: { id: true, username: true },
    });
    if (!player) {
      throw new NotFoundException('Member not found');
    }

    await this.moderation.assertNotBanned(params.venueId, player.id);

    const now = new Date();
    const dayKey = utcDayKey(now);

    await this.prisma.playerVenueVisitDay.upsert({
      where: {
        playerId_venueId_dayKey: {
          playerId: player.id,
          venueId: params.venueId,
          dayKey,
        },
      },
      create: { playerId: player.id, venueId: params.venueId, dayKey },
      update: {},
    });

    const existingVenue = await this.playerVenues.findByPlayerAndVenue(
      player.id,
      params.venueId,
    );
    if (!existingVenue) {
      await this.playerVenues.create({
        player: { connect: { id: player.id } },
        venue: { connect: { id: params.venueId } },
      });
    }

    if (venue.requiresExplicitCheckIn) {
      await this.explicitCheckIns.upsertCheckIn(player.id, params.venueId);
    }

    await this.discovery.setPresence(player.id, params.venueId);

    this.funnel.safeLog({
      venueId: params.venueId,
      playerId: player.id,
      kind: 'member_scan',
    });

    void this.challenges.bumpActiveChallengesForPlayerAtVenue({
      playerId: player.id,
      venueId: params.venueId,
      trustVenuePresence: true,
    });

    return {
      playerId: player.id,
      username: player.username,
      visitDayKey: dayKey,
    };
  }
}
