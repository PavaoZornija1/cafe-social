/**
 * Idempotent test content for the partner venue named "asd".
 * Does not touch geofence / coordinates / polygon.
 *
 *   cd backend && npx ts-node prisma/seed-venue-asd.ts
 */
import 'dotenv/config';
import {
  ChallengeAutoProgressSource,
  ChallengeScheduleType,
  CampaignStatus,
  PrismaClient,
  VenueOfferFulfillment,
  VenueOfferStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DIRECT_DATABASE_URL?.trim() ||
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Set DATABASE_URL (or DIRECT_DATABASE_URL) for seed-venue-asd');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Stable IDs so re-runs upsert cleanly. */
const IDS = {
  perkWord: 'a5d10001-0001-4000-8000-000000000001',
  perkBrawler: 'a5d10001-0001-4000-8000-000000000002',
  perkHappyHour: 'a5d10001-0001-4000-8000-000000000003',
  perkCheckIn: 'a5d10001-0001-4000-8000-000000000004',
  perkAuto: 'a5d10001-0001-4000-8000-000000000005',
  offerFeatured: 'a5d20001-0001-4000-8000-000000000001',
  offerWeekend: 'a5d20001-0001-4000-8000-000000000002',
  offerStudent: 'a5d20001-0001-4000-8000-000000000003',
  chWordOnce: 'a5d30001-0001-4000-8000-000000000001',
  chWordThree: 'a5d30001-0001-4000-8000-000000000002',
  chHappyHour: 'a5d30001-0001-4000-8000-000000000003',
  chBrawlerWin: 'a5d30001-0001-4000-8000-000000000004',
  chDailyWord: 'a5d30001-0001-4000-8000-000000000005',
  chPresence: 'a5d30001-0001-4000-8000-000000000006',
  chManual: 'a5d30001-0001-4000-8000-000000000007',
  campaign: 'a5d40001-0001-4000-8000-000000000001',
} as const;

async function main() {
  const venue = await prisma.venue.findFirst({
    where: { name: { equals: 'asd', mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      analyticsTimeZone: true,
      menuUrl: true,
      orderingUrl: true,
      _count: { select: { challenges: true, perks: true, offers: true, campaigns: true } },
    },
  });

  if (!venue) {
    const names = await prisma.venue.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
    console.error('No venue named "asd" found. Nearby venues:');
    for (const v of names) console.error(`  - ${v.name} (${v.id})`);
    process.exit(1);
  }

  const venueId = venue.id;
  console.log(`Seeding test content for venue "${venue.name}" (${venueId})`);
  console.log(
    `  before: challenges=${venue._count.challenges} perks=${venue._count.perks} offers=${venue._count.offers} campaigns=${venue._count.campaigns}`,
  );

  // Soft partner fields only — never geofence / lat / lng / polygon.
  // Unlock trial-expired partner venues so challenges are visible in the app
  // (`ChallengeService` returns [] when `venue.locked`).
  const venueFull = await prisma.venue.findUniqueOrThrow({
    where: { id: venueId },
    select: {
      locked: true,
      lockReason: true,
      organizationId: true,
      menuUrl: true,
      orderingUrl: true,
      analyticsTimeZone: true,
    },
  });
  if (venueFull.organizationId) {
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await prisma.venueOrganization.update({
      where: { id: venueFull.organizationId },
      data: { trialEndsAt },
    });
  }
  await prisma.venue.update({
    where: { id: venueId },
    data: {
      locked: false,
      lockReason: null,
      analyticsTimeZone: venueFull.analyticsTimeZone?.trim() || 'Europe/Sarajevo',
      ...(venueFull.menuUrl ? {} : { menuUrl: 'https://example.com/asd/menu' }),
      ...(venueFull.orderingUrl ? {} : { orderingUrl: 'https://example.com/asd/order' }),
    },
  });
  if (venueFull.locked) {
    console.log(
      `  unlocked venue (was locked: ${venueFull.lockReason ?? 'unknown'}) and extended org trial 30d`,
    );
  }

  const perks = [
    {
      id: IDS.perkWord,
      code: 'ASD_WORD_SESSION',
      title: 'Free espresso shot',
      subtitle: 'Word challenge reward',
      body: 'Show staff after finishing a word session at asd.',
      autoRedeem: false,
    },
    {
      id: IDS.perkBrawler,
      code: 'ASD_BRAWLER_WIN',
      title: 'Cookie on the house',
      subtitle: 'Brawler win reward',
      body: 'Win a brawler match while checked in.',
      autoRedeem: false,
    },
    {
      id: IDS.perkHappyHour,
      code: 'ASD_HAPPY_HOUR',
      title: 'Happy-hour pastry',
      subtitle: '2–3 PM word games',
      body: 'Complete 3 word sessions during happy hour.',
      autoRedeem: false,
    },
    {
      id: IDS.perkCheckIn,
      code: 'ASD_CHECK_IN',
      title: 'Welcome stamp',
      subtitle: 'Check-in challenge',
      body: 'Check in at the café once.',
      autoRedeem: false,
    },
    {
      id: IDS.perkAuto,
      code: 'ASD_AUTO_REDEEM',
      title: 'Digital high-five',
      subtitle: 'Auto-redeem (no staff scan)',
      body: 'Granted automatically — no staff code needed.',
      autoRedeem: true,
    },
  ] as const;

  for (const p of perks) {
    await prisma.venuePerk.upsert({
      where: { code: p.code },
      update: {
        venueId,
        title: p.title,
        subtitle: p.subtitle,
        body: p.body,
        autoRedeem: p.autoRedeem,
        requiresQrUnlock: false,
      },
      create: {
        id: p.id,
        venueId,
        code: p.code,
        title: p.title,
        subtitle: p.subtitle,
        body: p.body,
        autoRedeem: p.autoRedeem,
        requiresQrUnlock: false,
      },
    });
  }

  // Resolve perk ids by code (stable for challenge rewardPerkId links).
  const perkIdByCode = new Map<string, string>();
  for (const p of perks) {
    const row = await prisma.venuePerk.findUniqueOrThrow({ where: { code: p.code } });
    perkIdByCode.set(p.code, row.id);
  }

  const offers = [
    {
      id: IDS.offerFeatured,
      title: '2× XP this afternoon',
      body: 'Play games at asd — venue XP is automatically doubled while this promo is live. No claim needed.',
      isFeatured: true,
      fulfillment: VenueOfferFulfillment.AUTO,
      autoXpMultiplier: 2,
    },
    {
      id: IDS.offerWeekend,
      title: 'Weekend pastry + coffee',
      body: 'Buy any coffee, get 50% off a pastry. Claim in the app, then show your member card to staff.',
      isFeatured: false,
      fulfillment: VenueOfferFulfillment.MEMBER_CARD,
      maxRedemptionsPerPlayer: 1,
    },
    {
      id: IDS.offerStudent,
      title: 'Student co-op night',
      body: 'Bring a friend for co-op word rooms. Claim in the app, then show your member card to staff.',
      isFeatured: false,
      fulfillment: VenueOfferFulfillment.MEMBER_CARD,
      maxRedemptions: 100,
    },
  ] as const;

  for (const o of offers) {
    await prisma.venueOffer.upsert({
      where: { id: o.id },
      update: {
        venueId,
        title: o.title,
        body: o.body,
        isFeatured: o.isFeatured,
        status: VenueOfferStatus.ACTIVE,
        fulfillment: o.fulfillment,
        autoXpMultiplier: 'autoXpMultiplier' in o ? o.autoXpMultiplier : null,
        maxRedemptions: 'maxRedemptions' in o ? o.maxRedemptions : null,
        maxRedemptionsPerPlayer:
          'maxRedemptionsPerPlayer' in o ? o.maxRedemptionsPerPlayer : null,
      },
      create: {
        id: o.id,
        venueId,
        title: o.title,
        body: o.body,
        isFeatured: o.isFeatured,
        status: VenueOfferStatus.ACTIVE,
        fulfillment: o.fulfillment,
        autoXpMultiplier: 'autoXpMultiplier' in o ? o.autoXpMultiplier : null,
        maxRedemptions: 'maxRedemptions' in o ? o.maxRedemptions : null,
        maxRedemptionsPerPlayer:
          'maxRedemptionsPerPlayer' in o ? o.maxRedemptionsPerPlayer : null,
      },
    });
  }

  const challenges = [
    {
      id: IDS.chWordOnce,
      title: '1 word session at asd',
      description: 'Finish any word game session while at this café.',
      autoProgressSource: ChallengeAutoProgressSource.WORD_MATCH,
      targetCount: 1,
      locationRequired: true,
      rewardVenueSpecific: true,
      resetsWeekly: false,
      requiresWin: false,
      scheduleType: ChallengeScheduleType.ALWAYS,
      rewardPerkCode: 'ASD_WORD_SESSION',
    },
    {
      id: IDS.chWordThree,
      title: 'Play 3 word games',
      description: 'Three word sessions (works from home if not location-gated).',
      autoProgressSource: ChallengeAutoProgressSource.WORD_MATCH,
      targetCount: 3,
      locationRequired: false,
      rewardVenueSpecific: false,
      resetsWeekly: false,
      requiresWin: false,
      scheduleType: ChallengeScheduleType.ALWAYS,
      rewardPerkCode: 'ASD_AUTO_REDEEM',
    },
    {
      id: IDS.chHappyHour,
      title: 'Happy hour: 3 word sessions',
      description: 'Play 3 word games between 14:00–15:00 local (venue timezone).',
      autoProgressSource: ChallengeAutoProgressSource.WORD_MATCH,
      targetCount: 3,
      locationRequired: true,
      rewardVenueSpecific: true,
      resetsWeekly: true,
      requiresWin: false,
      scheduleType: ChallengeScheduleType.DAILY_RECURRING,
      dailyStartMinutes: 14 * 60,
      dailyEndMinutes: 15 * 60,
      rewardPerkCode: 'ASD_HAPPY_HOUR',
    },
    {
      id: IDS.chBrawlerWin,
      title: 'Brawler warm-up win',
      description: 'Win one brawler match while checked in.',
      autoProgressSource: ChallengeAutoProgressSource.BRAWLER,
      targetCount: 1,
      locationRequired: true,
      rewardVenueSpecific: true,
      resetsWeekly: false,
      requiresWin: true,
      scheduleType: ChallengeScheduleType.ALWAYS,
      rewardPerkCode: 'ASD_BRAWLER_WIN',
    },
    {
      id: IDS.chDailyWord,
      title: 'Daily word streak (3)',
      description: 'Solve the venue daily word three times.',
      autoProgressSource: ChallengeAutoProgressSource.DAILY_WORD,
      targetCount: 3,
      locationRequired: false,
      rewardVenueSpecific: true,
      resetsWeekly: false,
      requiresWin: false,
      scheduleType: ChallengeScheduleType.ALWAYS,
      rewardPerkCode: null,
    },
    {
      id: IDS.chPresence,
      title: 'Check in once',
      description: 'QR check-in or staff member-card scan at asd.',
      autoProgressSource: ChallengeAutoProgressSource.PRESENCE,
      targetCount: 1,
      locationRequired: true,
      rewardVenueSpecific: true,
      resetsWeekly: false,
      requiresWin: false,
      scheduleType: ChallengeScheduleType.ALWAYS,
      rewardPerkCode: 'ASD_CHECK_IN',
    },
    {
      id: IDS.chManual,
      title: 'Staff stamp (manual)',
      description: 'Ask staff to confirm — tap Record progress in the app (MANUAL source).',
      autoProgressSource: ChallengeAutoProgressSource.MANUAL,
      targetCount: 1,
      locationRequired: true,
      rewardVenueSpecific: true,
      resetsWeekly: false,
      requiresWin: false,
      scheduleType: ChallengeScheduleType.ALWAYS,
      rewardPerkCode: null,
    },
  ] as const;

  for (const c of challenges) {
    const rewardPerkId = c.rewardPerkCode
      ? perkIdByCode.get(c.rewardPerkCode) ?? null
      : null;
    await prisma.challenge.upsert({
      where: { id: c.id },
      update: {
        venueId,
        title: c.title,
        description: c.description,
        autoProgressSource: c.autoProgressSource,
        targetCount: c.targetCount,
        locationRequired: c.locationRequired,
        rewardVenueSpecific: c.rewardVenueSpecific,
        resetsWeekly: c.resetsWeekly,
        requiresWin: c.requiresWin,
        scheduleType: c.scheduleType,
        dailyStartMinutes: 'dailyStartMinutes' in c ? c.dailyStartMinutes : null,
        dailyEndMinutes: 'dailyEndMinutes' in c ? c.dailyEndMinutes : null,
        rewardPerkId,
      },
      create: {
        id: c.id,
        venueId,
        title: c.title,
        description: c.description,
        autoProgressSource: c.autoProgressSource,
        targetCount: c.targetCount,
        locationRequired: c.locationRequired,
        rewardVenueSpecific: c.rewardVenueSpecific,
        resetsWeekly: c.resetsWeekly,
        requiresWin: c.requiresWin,
        scheduleType: c.scheduleType,
        dailyStartMinutes: 'dailyStartMinutes' in c ? c.dailyStartMinutes : null,
        dailyEndMinutes: 'dailyEndMinutes' in c ? c.dailyEndMinutes : null,
        rewardPerkId,
      },
    });
  }

  await prisma.venueCampaign.upsert({
    where: { id: IDS.campaign },
    update: {
      venueId,
      name: 'asd welcome push',
      title: 'Come play at asd',
      body: 'New challenges and perks are live — check in and play a word game.',
      segmentDays: 30,
      status: CampaignStatus.DRAFT,
    },
    create: {
      id: IDS.campaign,
      venueId,
      name: 'asd welcome push',
      title: 'Come play at asd',
      body: 'New challenges and perks are live — check in and play a word game.',
      segmentDays: 30,
      status: CampaignStatus.DRAFT,
    },
  });

  // Bind campaign to featured offer + word challenge (metadata for partner UI).
  const wordPerkId = perkIdByCode.get('ASD_WORD_SESSION')!;
  for (const [entityType, entityId] of [
    ['OFFER', IDS.offerFeatured],
    ['CHALLENGE', IDS.chWordOnce],
    ['PERK', wordPerkId],
  ] as const) {
    await prisma.venueCampaignBinding.upsert({
      where: {
        campaignId_entityType_entityId: {
          campaignId: IDS.campaign,
          entityType,
          entityId,
        },
      },
      update: {},
      create: {
        campaignId: IDS.campaign,
        entityType,
        entityId,
      },
    });
  }

  const after = await prisma.venue.findUniqueOrThrow({
    where: { id: venueId },
    select: {
      analyticsTimeZone: true,
      menuUrl: true,
      _count: { select: { challenges: true, perks: true, offers: true, campaigns: true } },
    },
  });

  console.log('Done.');
  console.log(
    `  after: challenges=${after._count.challenges} perks=${after._count.perks} offers=${after._count.offers} campaigns=${after._count.campaigns}`,
  );
  console.log(`  analyticsTimeZone=${after.analyticsTimeZone}`);
  console.log('  Perk codes: ASD_WORD_SESSION, ASD_BRAWLER_WIN, ASD_HAPPY_HOUR, ASD_CHECK_IN, ASD_AUTO_REDEEM');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
