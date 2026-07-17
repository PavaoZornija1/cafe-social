import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscoveryService } from '../social/discovery.service';
import { utcDayKey } from '../lib/day-key';
import { parseMemberTokenFromQr } from '../lib/member-card-qr';
import { PrismaService } from '../prisma/prisma.service';
import { VenueFunnelService } from '../venue/venue-funnel.service';
import { VenueModerationService } from '../venue/venue-moderation.service';
import { PlayerVenueCheckInRepository } from '../venue/player-venue-check-in.repository';
import { PlayerVenueRepository } from '../venue/player-venue.repository';
import { ChallengeService } from '../challenge/challenge.service';
import { ChallengeAutoProgressSource } from '@prisma/client';
import { VenueOfferService } from '../venue/venue-offer.service';
import { VenueStaffService } from '../venue-staff/venue-staff.service';

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
    private readonly offers: VenueOfferService,
    private readonly venueStaff: VenueStaffService,
  ) {}

  /**
   * Staff scans a guest's personal member QR at a venue — records today's visit and check-in,
   * and returns pending MEMBER_CARD offers for staff to honour.
   */
  async scanMemberCardAtVenue(params: {
    venueId: string;
    qrPayload: string;
  }): Promise<{
    playerId: string;
    username: string;
    visitDayKey: string;
    pendingOffers: {
      redemptionId: string;
      offerId: string;
      title: string;
      body: string | null;
      claimedAt: string;
    }[];
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

    // Staff are guests elsewhere, but at their own venue a member scan would
    // record visits/check-ins and progress challenges — guest rewards they may not receive.
    if (await this.venueStaff.isStaffAtVenue(player.id, params.venueId)) {
      throw new ForbiddenException(
        'Venue staff cannot be scanned as guests at their own venue',
      );
    }

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
      activityAtVenue: true,
      countsAsWin: true,
      source: ChallengeAutoProgressSource.PRESENCE,
    });
    // Staff member-card stamp also progresses MANUAL challenges (no guest tap).
    void this.challenges.bumpActiveChallengesForPlayerAtVenue({
      playerId: player.id,
      venueId: params.venueId,
      trustVenuePresence: true,
      activityAtVenue: true,
      countsAsWin: true,
      source: ChallengeAutoProgressSource.MANUAL,
    });

    const pendingOffers = await this.offers.listPendingMemberCardOffersForPlayer(
      params.venueId,
      player.id,
    );

    return {
      playerId: player.id,
      username: player.username,
      visitDayKey: dayKey,
      pendingOffers,
    };
  }

  async fulfillMemberCardOffer(params: {
    venueId: string;
    redemptionId: string;
    staffPlayerId: string;
  }) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: params.venueId },
      select: { id: true, locked: true },
    });
    if (!venue || venue.locked) {
      throw new NotFoundException('Venue not found');
    }
    return this.offers.fulfillMemberCardOffer(params);
  }
}
