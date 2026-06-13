import { Prisma, PrismaClient, VenueOfferStatus } from '@prisma/client';
import {
  platformQuestBundleRewardKey,
  tierRewardKey,
} from '../src/lib/platform-reward-key.util';
import { VENUE_TYPE_CODES } from '../src/lib/venue-taxonomy';
import { polygonFromCenterRadiusMeters } from '../src/venue/geofence';

const GEOFENCE_RADIUS_M = 80;

type PilotVenueSeed = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isPremium: boolean;
  city: string;
  country: string;
  region: string;
  menuUrl?: string;
  orderingUrl?: string;
  venueTypeCodes: string[];
};

/** Seed-only stable venue IDs for idempotent local dev — not referenced by runtime code. */
export const SEED_VENUE_IDS = {
  avlija: '8ac7d2f6-9a5a-4d2b-8f5c-3c7bd3e7d5c1',
  ministry: '1c6e7e2a-2a1d-4f61-9d31-2b5b3c1b0b7a',
  caffeineLab: '2d4f8a1b-6c3e-4a9f-b1e2-7c8d9e0f1a2b',
  beanBloom: '3e5a9b2c-7d4f-5b0a-c2f3-8d9e0f1a2b3c',
  espressoSociety: '4f6b0c3d-8e5a-6c1b-d3a4-9e0f1a2b3c4d',
} as const;

const PILOT_VENUES: PilotVenueSeed[] = [
  {
    id: SEED_VENUE_IDS.avlija,
    name: 'Kafić Avlija',
    address: 'Obala Kulina bana 12, Sarajevo',
    latitude: 43.8563,
    longitude: 18.4131,
    isPremium: false,
    city: 'Sarajevo',
    country: 'BA',
    region: 'Europe',
    menuUrl: 'https://example.com/avlija/menu',
    orderingUrl: 'https://example.com/avlija/order',
    venueTypeCodes: [VENUE_TYPE_CODES.COFFEE_SHOP],
  },
  {
    id: SEED_VENUE_IDS.ministry,
    name: 'Ministry of Ćejf',
    address: 'Franje Račkog 3, Sarajevo',
    latitude: 43.8613,
    longitude: 18.4162,
    isPremium: true,
    city: 'Sarajevo',
    country: 'BA',
    region: 'Europe',
    menuUrl: 'https://example.com/ministry/menu',
    venueTypeCodes: [VENUE_TYPE_CODES.COFFEE_SHOP, VENUE_TYPE_CODES.BAKERY],
  },
  {
    id: SEED_VENUE_IDS.caffeineLab,
    name: 'Caffeine Lab',
    address: 'Zmaja od Bosne 8, Sarajevo',
    latitude: 43.8534,
    longitude: 18.4012,
    isPremium: false,
    city: 'Sarajevo',
    country: 'BA',
    region: 'Europe',
    venueTypeCodes: [VENUE_TYPE_CODES.COFFEE_SHOP],
  },
  {
    id: SEED_VENUE_IDS.beanBloom,
    name: 'Bean & Bloom',
    address: 'Titova 15, Sarajevo',
    latitude: 43.8588,
    longitude: 18.4089,
    isPremium: false,
    city: 'Sarajevo',
    country: 'BA',
    region: 'Europe',
    venueTypeCodes: [VENUE_TYPE_CODES.COFFEE_SHOP, VENUE_TYPE_CODES.BAKERY],
  },
  {
    id: SEED_VENUE_IDS.espressoSociety,
    name: 'Espresso Society',
    address: 'Hamdije Kreševljakovića 50, Sarajevo',
    latitude: 43.8641,
    longitude: 18.4198,
    isPremium: false,
    city: 'Sarajevo',
    country: 'BA',
    region: 'Europe',
    venueTypeCodes: [VENUE_TYPE_CODES.COFFEE_SHOP],
  },
];

async function linkVenueVenueTypes(
  client: PrismaClient,
  venueId: string,
  codes: string[],
) {
  const normalized = [...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  const types = await client.venueType.findMany({
    where: { code: { in: normalized } },
  });
  await client.venueVenueType.deleteMany({ where: { venueId } });
  if (types.length > 0) {
    await client.venueVenueType.createMany({
      data: types.map((t) => ({ venueId, venueTypeId: t.id })),
    });
  }
}

async function upsertPerkByCode(
  prisma: PrismaClient,
  params: {
    code: string;
    venueId: string;
    title: string;
    subtitle?: string;
    body?: string;
  },
) {
  return prisma.venuePerk.upsert({
    where: { code: params.code },
    update: {
      venueId: params.venueId,
      title: params.title,
      subtitle: params.subtitle ?? null,
      body: params.body ?? null,
      requiresQrUnlock: false,
    },
    create: {
      venueId: params.venueId,
      code: params.code,
      title: params.title,
      subtitle: params.subtitle ?? null,
      body: params.body ?? null,
      requiresQrUnlock: false,
    },
  });
}

async function upsertAutomatedReward(
  prisma: PrismaClient,
  params: {
    rewardKey: string;
    perkCode?: string;
    label?: string;
    minLifetimeXp?: number | null;
  },
) {
  const perk = params.perkCode
    ? await prisma.venuePerk.findUnique({ where: { code: params.perkCode } })
    : null;

  await prisma.platformAutomatedReward.upsert({
    where: { rewardKey: params.rewardKey },
    update: {
      perkId: perk?.id ?? null,
      label: params.label ?? null,
      minLifetimeXp: params.minLifetimeXp ?? null,
      isActive: true,
    },
    create: {
      rewardKey: params.rewardKey,
      perkId: perk?.id ?? null,
      label: params.label ?? null,
      minLifetimeXp: params.minLifetimeXp ?? null,
      isActive: true,
    },
  });
}

/**
 * Five Sarajevo pilot venues with perks, offers, CMS reward links, and sample challenges.
 */
export async function seedPilotVenues(prisma: PrismaClient): Promise<void> {
  const venueByName = new Map<string, string>();

  for (const v of PILOT_VENUES) {
    const geofencePolygon = polygonFromCenterRadiusMeters(
      v.latitude,
      v.longitude,
      GEOFENCE_RADIUS_M,
    ) as unknown as Prisma.InputJsonValue;

    await prisma.venue.upsert({
      where: { id: v.id },
      update: {
        name: v.name,
        address: v.address,
        latitude: v.latitude,
        longitude: v.longitude,
        geofencePolygon,
        isPremium: v.isPremium,
        city: v.city,
        country: v.country,
        region: v.region,
        menuUrl: v.menuUrl ?? null,
        orderingUrl: v.orderingUrl ?? null,
      },
      create: {
        id: v.id,
        name: v.name,
        address: v.address,
        latitude: v.latitude,
        longitude: v.longitude,
        geofencePolygon,
        isPremium: v.isPremium,
        city: v.city,
        country: v.country,
        region: v.region,
        menuUrl: v.menuUrl ?? null,
        orderingUrl: v.orderingUrl ?? null,
      },
    });

    venueByName.set(v.name, v.id);
    await linkVenueVenueTypes(prisma, v.id, v.venueTypeCodes);
  }

  const avlijaId = venueByName.get('Kafić Avlija')!;
  const ministryId = venueByName.get('Ministry of Ćejf')!;
  const caffeineLabId = venueByName.get('Caffeine Lab')!;

  await upsertPerkByCode(prisma, {
    code: 'QUEST_DAILY_BUNDLE',
    venueId: avlijaId,
    title: 'Daily quest pastry',
    subtitle: 'Rewards hub bundle',
    body: 'Show staff after completing all daily challenges.',
  });
  await upsertPerkByCode(prisma, {
    code: 'QUEST_WEEKLY_BUNDLE',
    venueId: ministryId,
    title: 'Weekly quest surprise',
    subtitle: 'Rewards hub bundle',
    body: 'Show staff after completing all weekly challenges.',
  });
  await upsertPerkByCode(prisma, {
    code: 'TIER_SILVER',
    venueId: avlijaId,
    title: 'Silver tier drink upgrade',
    subtitle: '800 XP lifetime',
    body: 'Unlocked at Silver tier.',
  });
  await upsertPerkByCode(prisma, {
    code: 'TIER_GOLD',
    venueId: avlijaId,
    title: 'Gold tier pastry + drink',
    subtitle: '2000 XP lifetime',
    body: 'Unlocked at Gold tier.',
  });
  const wordChallengePerk = await upsertPerkByCode(prisma, {
    code: 'CHALLENGE_WORD_SESSION',
    venueId: avlijaId,
    title: 'First word session perk',
    subtitle: 'Venue challenge',
    body: 'Complete your first in-venue word session.',
  });

  await upsertAutomatedReward(prisma, {
    rewardKey: tierRewardKey('base'),
    label: 'Bronze',
    minLifetimeXp: 0,
  });
  await upsertAutomatedReward(prisma, {
    rewardKey: platformQuestBundleRewardKey('daily'),
    perkCode: 'QUEST_DAILY_BUNDLE',
    label: 'Pastry perk',
  });
  await upsertAutomatedReward(prisma, {
    rewardKey: platformQuestBundleRewardKey('weekly'),
    perkCode: 'QUEST_WEEKLY_BUNDLE',
    label: 'Mystery café perk',
  });
  await upsertAutomatedReward(prisma, {
    rewardKey: tierRewardKey('silver'),
    perkCode: 'TIER_SILVER',
    label: 'Silver',
    minLifetimeXp: 800,
  });
  await upsertAutomatedReward(prisma, {
    rewardKey: tierRewardKey('gold'),
    perkCode: 'TIER_GOLD',
    label: 'Gold',
    minLifetimeXp: 2000,
  });

  const offers = [
    {
      id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
      venueId: avlijaId,
      title: '2× XP hour',
      body: 'Play between 3–5 PM for double XP at this café.',
      isFeatured: true,
    },
    {
      id: 'f2b3c4d5-e6f7-8901-bcde-f12345678901',
      venueId: ministryId,
      title: 'Free croissant with any latte',
      body: 'Featured partner offer this week.',
      isFeatured: true,
    },
    {
      id: 'f3c4d5e6-f7a8-9012-cdef-123456789012',
      venueId: caffeineLabId,
      title: 'Student game night',
      body: 'Co-op word rooms every Thursday.',
      isFeatured: true,
    },
    {
      id: 'f4d5e6f7-a8b9-0123-def0-234567890123',
      venueId: venueByName.get('Bean & Bloom')!,
      title: 'Weekend pastry bundle',
      body: 'Buy any coffee, get 50% off a pastry Sat–Sun.',
      isFeatured: false,
    },
    {
      id: 'f5e6f7a8-b9c0-1234-ef01-345678901234',
      venueId: venueByName.get('Espresso Society')!,
      title: 'Morning rush XP boost',
      body: 'Double XP on solo word games before 10 AM.',
      isFeatured: true,
    },
  ];

  for (const o of offers) {
    await prisma.venueOffer.upsert({
      where: { id: o.id },
      update: {
        venueId: o.venueId,
        title: o.title,
        body: o.body,
        isFeatured: o.isFeatured,
        status: VenueOfferStatus.ACTIVE,
      },
      create: {
        id: o.id,
        venueId: o.venueId,
        title: o.title,
        body: o.body,
        isFeatured: o.isFeatured,
        status: VenueOfferStatus.ACTIVE,
      },
    });
  }

  const challenges = [
    {
      id: 'c3c4db0e-1a4a-4e1c-9d0f-9f6a4b5a0d01',
      venueId: avlijaId,
      title: '1 in-venue Word Session',
      description: 'Complete a Word Game session while at the café.',
      rewardVenueSpecific: true,
      locationRequired: true,
      targetCount: 1,
      resetsWeekly: false,
      rewardPerkId: wordChallengePerk.id,
    },
    {
      id: 'a7f2a6b9-3b8d-4a1c-8f6b-5d2a1b0c9e02',
      venueId: avlijaId,
      title: 'Play 3 Word Games',
      description: 'Progress your Word Game streak (works from home).',
      rewardVenueSpecific: false,
      locationRequired: false,
      targetCount: 3,
      resetsWeekly: false,
      rewardPerkId: null,
    },
    {
      id: 'f1e2d3c4-b5a6-4d7e-8f9a-0b1c2d3e4f5a',
      venueId: ministryId,
      title: 'Weekly venue sessions',
      description:
        'Complete 5 word sessions at Ministry of Ćejf during the current week (resets Monday UTC).',
      rewardVenueSpecific: true,
      locationRequired: true,
      targetCount: 5,
      resetsWeekly: true,
      rewardPerkId: null,
    },
    {
      id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      venueId: caffeineLabId,
      title: 'Daily word streak',
      description: 'Solve the venue daily word three days in a row.',
      rewardVenueSpecific: true,
      locationRequired: false,
      targetCount: 3,
      resetsWeekly: false,
      rewardPerkId: null,
    },
    {
      id: 'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
      venueId: venueByName.get('Bean & Bloom')!,
      title: 'Brawler warm-up',
      description: 'Finish one brawler match while checked in.',
      rewardVenueSpecific: true,
      locationRequired: true,
      targetCount: 1,
      resetsWeekly: false,
      rewardPerkId: null,
    },
  ];

  for (const c of challenges) {
    await prisma.challenge.upsert({
      where: { id: c.id },
      update: {
        venueId: c.venueId,
        title: c.title,
        description: c.description ?? null,
        rewardVenueSpecific: c.rewardVenueSpecific,
        locationRequired: c.locationRequired,
        targetCount: c.targetCount,
        resetsWeekly: c.resetsWeekly,
        rewardPerkId: c.rewardPerkId,
      },
      create: {
        id: c.id,
        venueId: c.venueId,
        title: c.title,
        description: c.description ?? null,
        rewardVenueSpecific: c.rewardVenueSpecific,
        locationRequired: c.locationRequired,
        targetCount: c.targetCount,
        resetsWeekly: c.resetsWeekly,
        rewardPerkId: c.rewardPerkId,
      },
    });
  }
}
