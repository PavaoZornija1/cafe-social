import {
  CampaignStatus,
  FriendshipStatus,
  GameEventType,
  GameParticipantResult,
  GameSessionStatus,
  GameType,
  InboxKind,
  InboxStatus,
  PartyInviteStatus,
  PlatformRole,
  PrismaClient,
  ReceiptSubmissionStatus,
  VenueFeedEventKind,
  VenueOfferStatus,
  VenueOrganizationKind,
  VenueStaffInviteStatus,
  VenueStaffRole,
} from '@prisma/client';
import { orderedPlayerPair } from '../src/common/player-pair';
import { isoWeekKeyUTC } from '../src/lib/week-key';
import { SEED_VENUE_IDS } from './seed-pilot-venues';

/** Stable demo IDs — safe to re-run seed (upserts). */
export const SEED_ORG_ID = 'a0000000-0000-4000-8000-000000000001';

export const SEED_PLAYER_IDS = {
  superAdmin: 'd0000000-0000-4000-8000-000000000001',
  owner: 'd0000000-0000-4000-8000-000000000002',
  maya: 'd0000000-0000-4000-8000-000000000010',
  leo: 'd0000000-0000-4000-8000-000000000011',
  ana: 'd0000000-0000-4000-8000-000000000012',
  sam: 'd0000000-0000-4000-8000-000000000013',
} as const;

const CHALLENGE_IDS = {
  avlijaWordSession: 'c3c4db0e-1a4a-4e1c-9d0f-9f6a4b5a0d01',
  avlijaThreeWordGames: 'a7f2a6b9-3b8d-4a1c-8f6b-5d2a1b0c9e02',
  ministryWeekly: 'f1e2d3c4-b5a6-4d7e-8f9a-0b1c2d3e4f5a',
} as const;

const OFFER_IDS = {
  avlijaXp: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
  ministryCroissant: 'f2b3c4d5-e6f7-8901-bcde-f12345678901',
} as const;

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function logStep(label: string): void {
  // eslint-disable-next-line no-console
  console.log(`  → ${label}`);
}

async function upsertPlayer(
  prisma: PrismaClient,
  params: {
    id: string;
    email: string;
    username: string;
    memberQrToken: string;
    platformRole?: PlatformRole;
    bonusXp?: number;
    wordRankRating?: number;
    brawlerRankRating?: number;
    lastPresenceVenueId?: string;
  },
) {
  await prisma.player.upsert({
    where: { id: params.id },
    update: {
      email: params.email,
      username: params.username,
      memberQrToken: params.memberQrToken,
      platformRole: params.platformRole ?? PlatformRole.NONE,
      bonusXp: params.bonusXp ?? 0,
      wordRankRating: params.wordRankRating ?? 1500,
      brawlerRankRating: params.brawlerRankRating ?? 1500,
      lastPresenceVenueId: params.lastPresenceVenueId ?? null,
      lastPresenceAt: params.lastPresenceVenueId ? new Date() : null,
      onboardingPlayerCompletedAt: new Date('2026-01-15T12:00:00.000Z'),
    },
    create: {
      id: params.id,
      email: params.email,
      username: params.username,
      memberQrToken: params.memberQrToken,
      platformRole: params.platformRole ?? PlatformRole.NONE,
      bonusXp: params.bonusXp ?? 0,
      wordRankRating: params.wordRankRating ?? 1500,
      brawlerRankRating: params.brawlerRankRating ?? 1500,
      lastPresenceVenueId: params.lastPresenceVenueId ?? null,
      lastPresenceAt: params.lastPresenceVenueId ? new Date() : null,
      onboardingPlayerCompletedAt: new Date('2026-01-15T12:00:00.000Z'),
    },
  });
}

/**
 * Rich demo dataset: players, social, games, partner portal, rewards, engagement.
 * Complements catalog seed (words, heroes, pilot venues).
 */
export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  const dayKey = utcDayKey();
  const weekKey = isoWeekKeyUTC();
  const { avlija, ministry, caffeineLab, beanBloom, espressoSociety } =
    SEED_VENUE_IDS;
  const { superAdmin, owner, maya, leo, ana, sam } = SEED_PLAYER_IDS;

  logStep('demo players');
  await upsertPlayer(prisma, {
    id: superAdmin,
    email: 'super@cafe-social.dev',
    username: 'superadmin',
    memberQrToken: 'seedQrSuperAdmin0000000001',
    platformRole: PlatformRole.SUPER_ADMIN,
  });
  await upsertPlayer(prisma, {
    id: owner,
    email: 'owner@cafe-social.dev',
    username: 'avlija_owner',
    memberQrToken: 'seedQrOwner00000000000001',
    bonusXp: 120,
  });
  await upsertPlayer(prisma, {
    id: maya,
    email: 'maya@cafe-social.dev',
    username: 'maya_s',
    memberQrToken: 'seedQrMaya0000000000000001',
    bonusXp: 420,
    wordRankRating: 1620,
    lastPresenceVenueId: avlija,
  });
  await upsertPlayer(prisma, {
    id: leo,
    email: 'leo@cafe-social.dev',
    username: 'leo_plays',
    memberQrToken: 'seedQrLeo00000000000000001',
    bonusXp: 210,
    wordRankRating: 1580,
    lastPresenceVenueId: ministry,
  });
  await upsertPlayer(prisma, {
    id: ana,
    email: 'ana@cafe-social.dev',
    username: 'ana_ba',
    memberQrToken: 'seedQrAna00000000000000001',
    bonusXp: 95,
    brawlerRankRating: 1710,
  });
  await upsertPlayer(prisma, {
    id: sam,
    email: 'sam@cafe-social.dev',
    username: 'sam_new',
    memberQrToken: 'seedQrSam00000000000000001',
    bonusXp: 0,
  });

  logStep('organization + venue partner fields');
  await prisma.venueOrganization.upsert({
    where: { id: SEED_ORG_ID },
    update: {
      name: 'Sarajevo Coffee Collective',
      slug: 'sarajevo-coffee',
      locationKind: VenueOrganizationKind.MULTI_LOCATION,
      trialStartedAt: new Date('2026-05-01T00:00:00.000Z'),
      trialEndsAt: daysFromNow(30),
      platformBillingStatus: 'TRIAL',
      guestPlayDailyGamesLimit: 50,
    },
    create: {
      id: SEED_ORG_ID,
      name: 'Sarajevo Coffee Collective',
      slug: 'sarajevo-coffee',
      locationKind: VenueOrganizationKind.MULTI_LOCATION,
      trialStartedAt: new Date('2026-05-01T00:00:00.000Z'),
      trialEndsAt: daysFromNow(30),
      platformBillingStatus: 'TRIAL',
      selfServeCreatedByPlayerId: owner,
      guestPlayDailyGamesLimit: 50,
    },
  });

  for (const venueId of Object.values(SEED_VENUE_IDS)) {
    await prisma.venue.update({
      where: { id: venueId },
      data: {
        organizationId: SEED_ORG_ID,
        analyticsTimeZone: 'Europe/Sarajevo',
        orderNudgeTitle: 'Still here?',
        orderNudgeBody: 'Treat yourself to something from the menu.',
        guestPlayDailyGamesLimit: 50,
      },
    });
  }

  await prisma.subscription.upsert({
    where: { playerId: maya },
    update: { active: true, expiresAt: daysFromNow(90) },
    create: {
      playerId: maya,
      active: true,
      expiresAt: daysFromNow(90),
    },
  });

  logStep('venue membership, XP, visits');
  const membershipPairs: Array<{ playerId: string; venueId: string; xp: number }> = [
    { playerId: maya, venueId: avlija, xp: 920 },
    { playerId: maya, venueId: ministry, xp: 340 },
    { playerId: leo, venueId: avlija, xp: 610 },
    { playerId: leo, venueId: caffeineLab, xp: 180 },
    { playerId: ana, venueId: ministry, xp: 1240 },
    { playerId: ana, venueId: beanBloom, xp: 90 },
    { playerId: sam, venueId: avlija, xp: 40 },
    { playerId: owner, venueId: avlija, xp: 0 },
  ];

  for (const { playerId, venueId, xp } of membershipPairs) {
    await prisma.playerVenue.upsert({
      where: { playerId_venueId: { playerId, venueId } },
      update: {},
      create: { playerId, venueId },
    });
    await prisma.playerVenueStats.upsert({
      where: { playerId_venueId: { playerId, venueId } },
      update: { venueXp: xp },
      create: { playerId, venueId, venueXp: xp },
    });
    await prisma.playerVenueVisitDay.upsert({
      where: {
        playerId_venueId_dayKey: { playerId, venueId, dayKey },
      },
      update: {},
      create: { playerId, venueId, dayKey },
    });
    await prisma.playerVenuePlayDay.upsert({
      where: {
        playerId_venueId_dayKey: { playerId, venueId, dayKey },
      },
      update: { gamesPlayed: 2 },
      create: { playerId, venueId, dayKey, gamesPlayed: 2 },
    });
  }

  await prisma.playerVenueCheckIn.upsert({
    where: { playerId_venueId: { playerId: maya, venueId: avlija } },
    update: { lastCheckInAt: new Date() },
    create: { playerId: maya, venueId: avlija, lastCheckInAt: new Date() },
  });

  logStep('venue staff + pending invite');
  await prisma.venueStaff.upsert({
    where: { venueId_playerId: { venueId: avlija, playerId: owner } },
    update: { role: VenueStaffRole.OWNER },
    create: {
      id: 'e0000000-0000-4000-8000-000000000001',
      venueId: avlija,
      playerId: owner,
      role: VenueStaffRole.OWNER,
    },
  });
  await prisma.venueStaff.upsert({
    where: { venueId_playerId: { venueId: avlija, playerId: superAdmin } },
    update: { role: VenueStaffRole.MANAGER },
    create: {
      id: 'e0000000-0000-4000-8000-000000000002',
      venueId: avlija,
      playerId: superAdmin,
      role: VenueStaffRole.MANAGER,
    },
  });
  await prisma.venueStaffInvite.upsert({
    where: { id: 'e1000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'e1000000-0000-4000-8000-000000000001',
      venueId: ministry,
      email: 'barista@cafe-social.dev',
      role: VenueStaffRole.EMPLOYEE,
      token: 'seed-staff-invite-ministry-001',
      invitedById: owner,
      status: VenueStaffInviteStatus.PENDING,
      expiresAt: daysFromNow(14),
    },
  });

  logStep('friendships + inbox');
  const mayaLeo = orderedPlayerPair(maya, leo);
  const friendshipAcceptedId = 'f0000000-0000-4000-8000-000000000001';
  await prisma.friendship.upsert({
    where: {
      playerLowId_playerHighId: {
        playerLowId: mayaLeo.low,
        playerHighId: mayaLeo.high,
      },
    },
    update: { status: FriendshipStatus.ACCEPTED },
    create: {
      id: friendshipAcceptedId,
      playerLowId: mayaLeo.low,
      playerHighId: mayaLeo.high,
      status: FriendshipStatus.ACCEPTED,
      requestedById: maya,
    },
  });

  const anaSam = orderedPlayerPair(ana, sam);
  const friendshipPendingId = 'f0000000-0000-4000-8000-000000000002';
  await prisma.friendship.upsert({
    where: {
      playerLowId_playerHighId: {
        playerLowId: anaSam.low,
        playerHighId: anaSam.high,
      },
    },
    update: { status: FriendshipStatus.PENDING },
    create: {
      id: friendshipPendingId,
      playerLowId: anaSam.low,
      playerHighId: anaSam.high,
      status: FriendshipStatus.PENDING,
      requestedById: ana,
    },
  });
  await prisma.playerInboxItem.upsert({
    where: { id: 'i0000000-0000-4000-8000-000000000001' },
    update: { status: InboxStatus.PENDING },
    create: {
      id: 'i0000000-0000-4000-8000-000000000001',
      recipientId: sam,
      actorId: ana,
      kind: InboxKind.FRIEND_REQUEST,
      status: InboxStatus.PENDING,
      friendshipId: friendshipPendingId,
    },
  });

  logStep('party + party invite');
  const partyId = 'p0000000-0000-4000-8000-000000000001';
  await prisma.party.upsert({
    where: { id: partyId },
    update: { name: 'Thursday word crew' },
    create: {
      id: partyId,
      name: 'Thursday word crew',
      creatorId: maya,
      leaderId: maya,
      maxMembers: 4,
    },
  });
  for (const memberId of [maya, leo]) {
    await prisma.partyMember.upsert({
      where: { partyId_playerId: { partyId, playerId: memberId } },
      update: {},
      create: { partyId, playerId: memberId },
    });
  }
  const partyInviteId = 'p1000000-0000-4000-8000-000000000001';
  await prisma.partyPlayerInvite.upsert({
    where: { partyId_invitedPlayerId: { partyId, invitedPlayerId: ana } },
    update: { status: PartyInviteStatus.PENDING },
    create: {
      id: partyInviteId,
      partyId,
      invitedPlayerId: ana,
      invitedById: maya,
      status: PartyInviteStatus.PENDING,
    },
  });
  await prisma.playerInboxItem.upsert({
    where: { id: 'i0000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: 'i0000000-0000-4000-8000-000000000002',
      recipientId: ana,
      actorId: maya,
      kind: InboxKind.PARTY_INVITE,
      status: InboxStatus.PENDING,
      partyInviteId,
      metadata: { partyName: 'Thursday word crew' },
    },
  });

  logStep('challenge progress');
  await prisma.challengeProgress.upsert({
    where: {
      playerId_challengeId: {
        playerId: maya,
        challengeId: CHALLENGE_IDS.avlijaWordSession,
      },
    },
    update: {
      progressCount: 1,
      completedAt: new Date('2026-06-10T14:00:00.000Z'),
    },
    create: {
      id: 'g0000000-0000-4000-8000-000000000001',
      playerId: maya,
      challengeId: CHALLENGE_IDS.avlijaWordSession,
      progressCount: 1,
      completedAt: new Date('2026-06-10T14:00:00.000Z'),
    },
  });
  await prisma.challengeProgress.upsert({
    where: {
      playerId_challengeId: {
        playerId: leo,
        challengeId: CHALLENGE_IDS.avlijaThreeWordGames,
      },
    },
    update: { progressCount: 2 },
    create: {
      id: 'g0000000-0000-4000-8000-000000000002',
      playerId: leo,
      challengeId: CHALLENGE_IDS.avlijaThreeWordGames,
      progressCount: 2,
    },
  });
  await prisma.challengeProgress.upsert({
    where: {
      playerId_challengeId: {
        playerId: ana,
        challengeId: CHALLENGE_IDS.ministryWeekly,
      },
    },
    update: { progressCount: 3, periodKey: weekKey },
    create: {
      id: 'g0000000-0000-4000-8000-000000000003',
      playerId: ana,
      challengeId: CHALLENGE_IDS.ministryWeekly,
      progressCount: 3,
      periodKey: weekKey,
    },
  });

  logStep('finished game sessions + stats');
  const wordSessionId = 's0000000-0000-4000-8000-000000000001';
  const mayaParticipantId = 's1000000-0000-4000-8000-000000000001';
  const leoParticipantId = 's1000000-0000-4000-8000-000000000002';
  await prisma.gameSession.upsert({
    where: { id: wordSessionId },
    update: {},
    create: {
      id: wordSessionId,
      gameType: GameType.WORD_GAME,
      status: GameSessionStatus.FINISHED,
      inviteCode: 'SEED01',
      venueId: avlija,
      partyId,
      startedAt: new Date('2026-06-12T17:00:00.000Z'),
      endedAt: new Date('2026-06-12T17:08:00.000Z'),
      winXpAwardedAt: new Date('2026-06-12T17:08:01.000Z'),
      rankAwardedAt: new Date('2026-06-12T17:08:01.000Z'),
      winnerParticipantId: mayaParticipantId,
    },
  });
  await prisma.wordSession.upsert({
    where: { sessionId: wordSessionId },
    update: { wordsSolvedCount: 5, sharedWordIndex: 5 },
    create: {
      sessionId: wordSessionId,
      roundCount: 5,
      language: 'en',
      sharedWordIndex: 5,
      wordsSolvedCount: 5,
    },
  });
  for (const [pid, playerId, placement, result, correct] of [
    [mayaParticipantId, maya, 1, GameParticipantResult.WIN, 5],
    [leoParticipantId, leo, 2, GameParticipantResult.LOSS, 3],
  ] as const) {
    await prisma.gameParticipant.upsert({
      where: { id: pid },
      update: {},
      create: {
        id: pid,
        sessionId: wordSessionId,
        playerId,
        displayNameSnapshot: playerId === maya ? 'maya_s' : 'leo_plays',
        placement,
        score: correct * 100,
        result,
      },
    });
    await prisma.wordParticipantStats.upsert({
      where: { participantId: pid },
      update: { correctAnswers: correct, wrongAnswers: 5 - correct },
      create: {
        participantId: pid,
        correctAnswers: correct,
        wrongAnswers: 5 - correct,
        streakBest: 3,
      },
    });
  }
  await prisma.gameEvent.upsert({
    where: { id: 'ev000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'ev000000-0000-4000-8000-000000000001',
      sessionId: wordSessionId,
      gameType: GameType.WORD_GAME,
      eventType: GameEventType.SESSION_STARTED,
      atMs: 0,
      actorParticipantId: mayaParticipantId,
    },
  });

  const brawlerSessionId = 's0000000-0000-4000-8000-000000000002';
  const anaParticipantId = 's1000000-0000-4000-8000-000000000003';
  await prisma.gameSession.upsert({
    where: { id: brawlerSessionId },
    update: {},
    create: {
      id: brawlerSessionId,
      gameType: GameType.BRAWLER,
      status: GameSessionStatus.FINISHED,
      venueId: beanBloom,
      startedAt: new Date('2026-06-11T19:00:00.000Z'),
      endedAt: new Date('2026-06-11T19:04:00.000Z'),
      winXpAwardedAt: new Date('2026-06-11T19:04:01.000Z'),
      winnerParticipantId: anaParticipantId,
    },
  });
  await prisma.brawlerSession.upsert({
    where: { sessionId: brawlerSessionId },
    update: {},
    create: { sessionId: brawlerSessionId },
  });
  await prisma.gameParticipant.upsert({
    where: { id: anaParticipantId },
    update: {},
    create: {
      id: anaParticipantId,
      sessionId: brawlerSessionId,
      playerId: ana,
      brawlerHeroId: 'hero_frost',
      displayNameSnapshot: 'ana_ba',
      placement: 1,
      score: 3,
      kills: 3,
      deaths: 1,
      result: GameParticipantResult.WIN,
    },
  });
  await prisma.brawlerParticipantStats.upsert({
    where: { participantId: anaParticipantId },
    update: {},
    create: {
      participantId: anaParticipantId,
      damageDealt: 420,
      damageTaken: 180,
      ringOuts: 3,
      falls: 1,
      powerupsPicked: 2,
      powerupsUsed: 1,
    },
  });

  for (const [playerId, gameType, wins, losses] of [
    [maya, GameType.WORD_GAME, 12, 4],
    [leo, GameType.WORD_GAME, 8, 6],
    [ana, GameType.BRAWLER, 5, 2],
  ] as const) {
    await prisma.playerGameStats.upsert({
      where: { playerId_gameType: { playerId, gameType } },
      update: {
        matchesPlayed: wins + losses,
        wins,
        losses,
        lastPlayedAt: new Date(),
        firstPlayedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      create: {
        playerId,
        gameType,
        matchesPlayed: wins + losses,
        wins,
        losses,
        lastPlayedAt: new Date(),
        firstPlayedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    });
  }
  await prisma.playerGameVenueStats.upsert({
    where: {
      playerId_venueId_gameType: {
        playerId: maya,
        venueId: avlija,
        gameType: GameType.WORD_GAME,
      },
    },
    update: { matchesPlayed: 6, wins: 4 },
    create: {
      playerId: maya,
      venueId: avlija,
      gameType: GameType.WORD_GAME,
      matchesPlayed: 6,
      wins: 4,
    },
  });

  logStep('venue feed + daily word + quests');
  await prisma.venueFeedEvent.upsert({
    where: { id: 'fe000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'fe000000-0000-4000-8000-000000000001',
      venueId: avlija,
      kind: VenueFeedEventKind.WORD_MATCH_STARTED,
      title: 'Co-op word match',
      subtitle: 'maya_s & leo_plays',
      actorUsername: 'maya_s',
      createdAt: new Date('2026-06-12T17:00:00.000Z'),
    },
  });
  await prisma.venueFeedEvent.upsert({
    where: { id: 'fe000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: 'fe000000-0000-4000-8000-000000000002',
      venueId: ministry,
      kind: VenueFeedEventKind.DAILY_WORD_SOLVED,
      title: 'Daily word solved',
      actorUsername: 'ana_ba',
      createdAt: new Date('2026-06-13T09:30:00.000Z'),
    },
  });

  await prisma.playerDailyWord.upsert({
    where: {
      playerId_dayKey_scopeKey: {
        playerId: maya,
        dayKey,
        scopeKey: avlija,
      },
    },
    update: { attempts: 2, solvedAt: new Date(), winXpAwarded: true },
    create: {
      id: 'dw000000-0000-4000-8000-000000000001',
      playerId: maya,
      dayKey,
      scopeKey: avlija,
      attempts: 2,
      solvedAt: new Date(),
      winXpAwarded: true,
    },
  });
  await prisma.playerDailyStreak.upsert({
    where: { playerId_scopeKey: { playerId: maya, scopeKey: avlija } },
    update: { currentStreak: 4, lastSolvedDayKey: dayKey },
    create: {
      playerId: maya,
      scopeKey: avlija,
      currentStreak: 4,
      lastSolvedDayKey: dayKey,
    },
  });
  await prisma.playerPlatformQuestClaim.upsert({
    where: {
      playerId_questKey_periodKey: {
        playerId: maya,
        questKey: 'platform.daily.bundle',
        periodKey: dayKey,
      },
    },
    update: { xpAwarded: 50 },
    create: {
      playerId: maya,
      questKey: 'platform.daily.bundle',
      periodKey: dayKey,
      xpAwarded: 50,
    },
  });

  logStep('rewards, offers, receipts, campaigns');
  const tierSilverPerk = await prisma.venuePerk.findUnique({
    where: { code: 'TIER_SILVER' },
  });
  if (tierSilverPerk) {
    const grantId = 'r0000000-0000-4000-8000-000000000001';
    await prisma.playerRewardGrant.upsert({
      where: { idempotencyKey: 'seed-grant-maya-tier-silver' },
      update: {},
      create: {
        id: grantId,
        playerId: maya,
        venueId: avlija,
        kind: 'PERK',
        perkId: tierSilverPerk.id,
        sourceType: 'PLATFORM_TIER',
        sourceId: 'tier.silver',
        idempotencyKey: 'seed-grant-maya-tier-silver',
        status: 'ACTIVE',
      },
    });
    await prisma.venuePerkRedemption.upsert({
      where: { id: 'rd000000-0000-4000-8000-000000000001' },
      update: {},
      create: {
        id: 'rd000000-0000-4000-8000-000000000001',
        perkId: tierSilverPerk.id,
        playerId: maya,
        venueId: avlija,
        status: 'REDEEMABLE',
        expiresAt: daysFromNow(7),
        playerRewardGrantId: grantId,
      },
    });
  }

  await prisma.venueOfferRedemption.upsert({
    where: { id: 'or000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'or000000-0000-4000-8000-000000000001',
      offerId: OFFER_IDS.avlijaXp,
      playerId: leo,
    },
  });

  await prisma.venueReceiptSubmission.upsert({
    where: { id: 'rc000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'rc000000-0000-4000-8000-000000000001',
      venueId: avlija,
      playerId: leo,
      imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
      status: ReceiptSubmissionStatus.PENDING,
      notePlayer: 'Latte + croissant',
    },
  });
  await prisma.venueReceiptSubmission.upsert({
    where: { id: 'rc000000-0000-4000-8000-000000000002' },
    update: {},
    create: {
      id: 'rc000000-0000-4000-8000-000000000002',
      venueId: ministry,
      playerId: ana,
      imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
      status: ReceiptSubmissionStatus.APPROVED,
      notePlayer: 'Weekend brunch',
      reviewedAt: new Date('2026-06-12T11:00:00.000Z'),
      reviewedByPlayerId: owner,
    },
  });

  const campaignDraftId = 'ca000000-0000-4000-8000-000000000001';
  const campaignSentId = 'ca000000-0000-4000-8000-000000000002';
  await prisma.venueCampaign.upsert({
    where: { id: campaignDraftId },
    update: {},
    create: {
      id: campaignDraftId,
      venueId: avlija,
      name: 'June happy hour',
      title: '2× XP this week',
      body: 'Play word games at Avlija before 5 PM for double XP.',
      segmentDays: 30,
      status: CampaignStatus.DRAFT,
    },
  });
  await prisma.venueCampaignBinding.upsert({
    where: {
      campaignId_entityType_entityId: {
        campaignId: campaignDraftId,
        entityType: 'CHALLENGE',
        entityId: CHALLENGE_IDS.avlijaWordSession,
      },
    },
    update: {},
    create: {
      id: 'cb000000-0000-4000-8000-000000000001',
      campaignId: campaignDraftId,
      entityType: 'CHALLENGE',
      entityId: CHALLENGE_IDS.avlijaWordSession,
    },
  });
  await prisma.venueCampaign.upsert({
    where: { id: campaignSentId },
    update: {},
    create: {
      id: campaignSentId,
      venueId: ministry,
      name: 'Pastry promo blast',
      title: 'Free croissant week',
      body: 'Show this push at the counter.',
      segmentDays: 14,
      status: CampaignStatus.COMPLETED,
      recipientCount: 2,
      pushSentCount: 2,
      sentAt: new Date('2026-06-01T10:00:00.000Z'),
    },
  });
  for (const [idx, playerId] of [maya, ana].entries()) {
    await prisma.venueCampaignSend.upsert({
      where: { id: `cs000000-0000-4000-8000-00000000000${idx + 1}` },
      update: {},
      create: {
        id: `cs000000-0000-4000-8000-00000000000${idx + 1}`,
        campaignId: campaignSentId,
        playerId,
        ok: true,
      },
    });
  }

  const coffeeNudge = await prisma.venueOrderNudgeTemplate.findUnique({
    where: { code: 'nudge_coffee_order_drink_v1' },
  });
  if (coffeeNudge) {
    await prisma.venueNudgeAssignment.upsert({
      where: {
        venueId_templateId: { venueId: avlija, templateId: coffeeNudge.id },
      },
      update: { enabled: true, sortOrder: 10 },
      create: {
        id: 'na000000-0000-4000-8000-000000000001',
        venueId: avlija,
        templateId: coffeeNudge.id,
        enabled: true,
        sortOrder: 10,
        afterMinutesOverride: 25,
      },
    });
  }

  logStep('solo session + push token sample');
  await prisma.soloWordSession.upsert({
    where: { id: 'sw000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: 'sw000000-0000-4000-8000-000000000001',
      playerId: sam,
      wordIds: [],
      language: 'en',
      venueId: espressoSociety,
      globalPlay: false,
      expiresAt: daysFromNow(1),
      finishedAt: null,
      wordsSolved: 0,
    },
  });
  await prisma.playerExpoPushToken.upsert({
    where: { token: 'ExponentPushToken[seed-demo-maya-device]' },
    update: { playerId: maya },
    create: {
      id: 'pt000000-0000-4000-8000-000000000001',
      playerId: maya,
      token: 'ExponentPushToken[seed-demo-maya-device]',
    },
  });

  // Bump offer redemption counter for realism
  await prisma.venueOffer.update({
    where: { id: OFFER_IDS.avlijaXp },
    data: { redemptionCount: 1, status: VenueOfferStatus.ACTIVE },
  });
}
