import { Prisma, PrismaClient, WordCategory } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  VENUE_NUDGE_TYPES,
  VENUE_TYPE_CODES,
} from '../src/lib/venue-taxonomy';
import { seedWordLocales } from './seed-word-locales';
import { seedPilotVenues } from './seed-pilot-venues';
import { seedDemoData } from './seed-demo-data';

const connectionString =
  process.env.DIRECT_DATABASE_URL?.trim() ||
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'Set DIRECT_DATABASE_URL (Supabase session pooler) or DATABASE_URL for seed',
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function seedVenueTaxonomy(client: PrismaClient) {
  const typeDefsFixed: { code: string; label: string }[] = [
    { code: VENUE_TYPE_CODES.RESTAURANT, label: 'Restaurant' },
    { code: VENUE_TYPE_CODES.COFFEE_SHOP, label: 'Coffee shop' },
    { code: VENUE_TYPE_CODES.BAR, label: 'Bar' },
    { code: VENUE_TYPE_CODES.BAKERY, label: 'Bakery' },
    { code: VENUE_TYPE_CODES.GAME_SHOP, label: 'Game shop' },
    { code: VENUE_TYPE_CODES.RETAIL, label: 'Retail' },
    { code: VENUE_TYPE_CODES.OTHER, label: 'Other' },
  ];

  for (const t of typeDefsFixed) {
    await client.venueType.upsert({
      where: { code: t.code },
      update: { label: t.label },
      create: { code: t.code, label: t.label },
    });
  }

  const templates: {
    code: string;
    nudgeType: string;
    titleTemplate: string;
    bodyTemplate: string;
    sortPriority: number;
    venueTypeCodes: string[];
  }[] = [
    {
      code: 'nudge_coffee_order_drink_v1',
      nudgeType: VENUE_NUDGE_TYPES.ORDER_DRINK,
      titleTemplate: 'Still here?',
      bodyTemplate: 'Treat yourself to another drink at {{venueName}}.',
      sortPriority: 10,
      venueTypeCodes: [VENUE_TYPE_CODES.COFFEE_SHOP],
    },
    {
      code: 'nudge_bar_order_drink_v1',
      nudgeType: VENUE_NUDGE_TYPES.ORDER_DRINK,
      titleTemplate: 'While you’re here',
      bodyTemplate: 'Grab something from the bar at {{venueName}}.',
      sortPriority: 10,
      venueTypeCodes: [VENUE_TYPE_CODES.BAR],
    },
    {
      code: 'nudge_restaurant_order_food_v1',
      nudgeType: VENUE_NUDGE_TYPES.ORDER_FOOD,
      titleTemplate: 'Hungry?',
      bodyTemplate: 'See what’s cooking at {{venueName}}.',
      sortPriority: 10,
      venueTypeCodes: [VENUE_TYPE_CODES.RESTAURANT],
    },
    {
      code: 'nudge_bakery_snack_v1',
      nudgeType: VENUE_NUDGE_TYPES.ORDER_SNACK,
      titleTemplate: 'Sweet break?',
      bodyTemplate: 'Something fresh might be waiting at {{venueName}}.',
      sortPriority: 10,
      venueTypeCodes: [VENUE_TYPE_CODES.BAKERY],
    },
    {
      code: 'nudge_game_shop_browse_v1',
      nudgeType: VENUE_NUDGE_TYPES.BROWSE_MENU,
      titleTemplate: 'While you play',
      bodyTemplate: 'Browse what’s in stock at {{venueName}}.',
      sortPriority: 10,
      venueTypeCodes: [VENUE_TYPE_CODES.GAME_SHOP],
    },
    {
      code: 'nudge_retail_browse_v1',
      nudgeType: VENUE_NUDGE_TYPES.BROWSE_MENU,
      titleTemplate: 'Still browsing?',
      bodyTemplate: 'Take a look at what {{venueName}} has for you.',
      sortPriority: 15,
      venueTypeCodes: [VENUE_TYPE_CODES.RETAIL],
    },
    {
      code: 'nudge_other_generic_v1',
      nudgeType: VENUE_NUDGE_TYPES.BROWSE_MENU,
      titleTemplate: 'Still here?',
      bodyTemplate: 'See what’s on offer at {{venueName}}.',
      sortPriority: 90,
      venueTypeCodes: [VENUE_TYPE_CODES.OTHER],
    },
  ];

  for (const tpl of templates) {
    const row = await client.venueOrderNudgeTemplate.upsert({
      where: { code: tpl.code },
      update: {
        nudgeType: tpl.nudgeType,
        titleTemplate: tpl.titleTemplate,
        bodyTemplate: tpl.bodyTemplate,
        sortPriority: tpl.sortPriority,
        active: true,
      },
      create: {
        code: tpl.code,
        nudgeType: tpl.nudgeType,
        titleTemplate: tpl.titleTemplate,
        bodyTemplate: tpl.bodyTemplate,
        sortPriority: tpl.sortPriority,
        active: true,
      },
    });
    for (const vtc of tpl.venueTypeCodes) {
      const vt = await client.venueType.findUnique({ where: { code: vtc } });
      if (!vt) continue;
      await client.venueOrderNudgeTemplateVenueType.upsert({
        where: {
          templateId_venueTypeId: { templateId: row.id, venueTypeId: vt.id },
        },
        create: { templateId: row.id, venueTypeId: vt.id },
        update: {},
      });
    }
  }
}

async function seedBrawlerPowerups(client: PrismaClient) {
  const defs: Array<{
    id: string;
    displayName: string;
    description: string;
    effectType:
      | 'MOVE_SPEED_MULT'
      | 'ATTACK_DMG_MULT'
      | 'JUMP_MULT'
      | 'DASH_SPEED_MULT'
      | 'DASH_COOLDOWN_MULT';
    magnitude: number;
    durationMs: number;
    spawnWeight: number;
    enabled: boolean;
    version: number;
  }> = [
    {
      id: 'speed_boost',
      displayName: 'Haste',
      description: 'Move faster for a short time.',
      effectType: 'MOVE_SPEED_MULT',
      magnitude: 1.25,
      durationMs: 9000,
      spawnWeight: 110,
      enabled: true,
      version: 1,
    },
    {
      id: 'attack_boost',
      displayName: 'Berserk',
      description: 'Deal more damage for a short time.',
      effectType: 'ATTACK_DMG_MULT',
      magnitude: 1.35,
      durationMs: 8000,
      spawnWeight: 95,
      enabled: true,
      version: 1,
    },
    {
      id: 'jump_boost',
      displayName: 'Spring',
      description: 'Jump higher for a short time.',
      effectType: 'JUMP_MULT',
      magnitude: 1.2,
      durationMs: 10000,
      spawnWeight: 100,
      enabled: true,
      version: 1,
    },
    {
      id: 'dash_boost',
      displayName: 'Afterburn',
      description: 'Dash faster for a short time.',
      effectType: 'DASH_SPEED_MULT',
      magnitude: 1.25,
      durationMs: 8000,
      spawnWeight: 80,
      enabled: true,
      version: 1,
    },
    {
      id: 'dash_cooldown_boost',
      displayName: 'Flow',
      description: 'Dash more often for a short time.',
      effectType: 'DASH_COOLDOWN_MULT',
      magnitude: 0.75,
      durationMs: 9000,
      spawnWeight: 70,
      enabled: true,
      version: 1,
    },
  ];

  for (const d of defs) {
    await client.brawlerPowerupDefinition.upsert({
      where: { id: d.id },
      update: {
        displayName: d.displayName,
        description: d.description,
        effectType: d.effectType,
        magnitude: d.magnitude,
        durationMs: d.durationMs,
        spawnWeight: d.spawnWeight,
        enabled: d.enabled,
        version: d.version,
      },
      create: d,
    });
  }
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('Seeding database…');
  const words = [
    // Drinks & Food
    {
      text: 'espresso',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'A small, strong shot of coffee served in a tiny cup.',
      wordHints: ['strong', 'shot', 'tiny cup', 'coffee'],
      emojiHints: ['☕', '💥'],
    },
    {
      text: 'cappuccino',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'Coffee with steamed milk and a thick layer of foam on top.',
      wordHints: ['foam', 'milk', 'coffee', 'cup'],
      emojiHints: ['☕', '🫧'],
    },
    {
      text: 'latte',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'A large, milky coffee drink often served with latte art.',
      wordHints: ['milk', 'coffee', 'big cup', 'art'],
      emojiHints: ['☕', '🎨'],
    },
    {
      text: 'macchiato',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'An espresso marked with just a little milk foam.',
      wordHints: ['espresso', 'foam', 'small'],
      emojiHints: ['☕', '🟤'],
    },
    {
      text: 'iced coffee',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'Cold coffee served over ice, perfect for hot days.',
      wordHints: ['cold', 'ice', 'summer'],
      emojiHints: ['🧊', '☕', '🌞'],
    },
    {
      text: 'herbal tea',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'A warm drink made from herbs and flowers, with no caffeine.',
      wordHints: ['herbs', 'relax', 'caffeine‑free'],
      emojiHints: ['🍵', '🌿'],
    },
    {
      text: 'lemonade',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'A sweet and sour drink made from lemons, sugar and water.',
      wordHints: ['lemon', 'sweet', 'sour'],
      emojiHints: ['🍋', '🥤'],
    },
    {
      text: 'croissant',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'A flaky, buttery pastry often eaten for breakfast.',
      wordHints: ['butter', 'pastry', 'breakfast'],
      emojiHints: ['🥐', '☕'],
    },
    {
      text: 'brownie',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'A dense, chocolate square often served with coffee.',
      wordHints: ['chocolate', 'square', 'dessert'],
      emojiHints: ['🍫', '🟫'],
    },
    {
      text: 'sandwich',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'Two slices of bread with something tasty in between.',
      wordHints: ['bread', 'lunch', 'filling'],
      emojiHints: ['🥪'],
    },

    // Places & Atmosphere
    {
      text: 'window seat',
      category: WordCategory.PLACE_ATMOSPHERE,
      sentenceHint: 'A spot next to the glass where you can watch the street.',
      wordHints: ['view', 'glass', 'outside'],
      emojiHints: ['🪟', '👀'],
    },
    {
      text: 'bar counter',
      category: WordCategory.PLACE_ATMOSPHERE,
      sentenceHint: 'The long wooden surface where drinks are prepared and served.',
      wordHints: ['stools', 'drinks', 'bartender'],
      emojiHints: ['🍸', '🪑'],
    },
    {
      text: 'terrace',
      category: WordCategory.PLACE_ATMOSPHERE,
      sentenceHint: 'An outdoor seating area of a café or bar.',
      wordHints: ['outside', 'tables', 'sun'],
      emojiHints: ['☀️', '🪑'],
    },
    {
      text: 'rooftop',
      category: WordCategory.PLACE_ATMOSPHERE,
      sentenceHint: 'A bar or café on top of a building with a great view.',
      wordHints: ['view', 'city', 'top'],
      emojiHints: ['🏙️', '⬆️'],
    },
    {
      text: 'cozy corner',
      category: WordCategory.PLACE_ATMOSPHERE,
      sentenceHint: 'A small, comfortable spot with soft chairs or a sofa.',
      wordHints: ['soft', 'quiet', 'comfortable'],
      emojiHints: ['🛋️', '🕯️'],
    },
    {
      text: 'city square',
      category: WordCategory.PLACE_ATMOSPHERE,
      sentenceHint: 'An open public place in the middle of town.',
      wordHints: ['center', 'fountain', 'people'],
      emojiHints: ['🏛️', '🧑‍🤝‍🧑'],
    },
    {
      text: 'riverside',
      category: WordCategory.PLACE_ATMOSPHERE,
      sentenceHint: 'A place to sit and drink next to flowing water.',
      wordHints: ['river', 'view', 'walk'],
      emojiHints: ['🌊', '🚶'],
    },
    {
      text: 'alleyway',
      category: WordCategory.PLACE_ATMOSPHERE,
      sentenceHint: 'A narrow path between buildings, often hiding cute cafés.',
      wordHints: ['narrow', 'buildings', 'hidden'],
      emojiHints: ['🏙️', '➡️'],
    },
    {
      text: 'neon sign',
      category: WordCategory.PLACE_ATMOSPHERE,
      sentenceHint: 'Bright colored light tubes that spell the bar’s name.',
      wordHints: ['bright', 'glow', 'letters'],
      emojiHints: ['💡', '🌈'],
    },
    {
      text: 'dance floor',
      category: WordCategory.PLACE_ATMOSPHERE,
      sentenceHint: 'The spot in a bar or club where everyone moves to the music.',
      wordHints: ['music', 'club', 'move'],
      emojiHints: ['💃', '🕺'],
    },

    // Music & Culture
    {
      text: 'jazz',
      category: WordCategory.MUSIC_CULTURE,
      sentenceHint: 'Smooth, improvised music with saxophones and pianos.',
      wordHints: ['smooth', 'saxophone', 'piano'],
      emojiHints: ['🎷', '🎹'],
    },
    {
      text: 'lo-fi',
      category: WordCategory.MUSIC_CULTURE,
      sentenceHint: 'Chill background beats people study or relax to.',
      wordHints: ['chill', 'beats', 'study'],
      emojiHints: ['🎧', '📚'],
    },
    {
      text: 'techno',
      category: WordCategory.MUSIC_CULTURE,
      sentenceHint: 'Fast electronic music often played late at night.',
      wordHints: ['electronic', 'club', 'beat'],
      emojiHints: ['🎛️', '🌃'],
    },
    {
      text: 'indie rock',
      category: WordCategory.MUSIC_CULTURE,
      sentenceHint: 'Guitar bands with a DIY vibe and emotional lyrics.',
      wordHints: ['band', 'guitar', 'independent'],
      emojiHints: ['🎸', '🎤'],
    },
    {
      text: 'acoustic guitar',
      category: WordCategory.MUSIC_CULTURE,
      sentenceHint: 'An unplugged instrument often used for live café sets.',
      wordHints: ['strings', 'unplugged', 'live'],
      emojiHints: ['🎸', '☕'],
    },
    {
      text: 'DJ set',
      category: WordCategory.MUSIC_CULTURE,
      sentenceHint: 'A person mixing tracks live for people to dance to.',
      wordHints: ['mix', 'club', 'party'],
      emojiHints: ['🎧', '🎚️'],
    },
    {
      text: 'playlist',
      category: WordCategory.MUSIC_CULTURE,
      sentenceHint: 'A curated list of songs that sets the mood.',
      wordHints: ['songs', 'queue', 'mood'],
      emojiHints: ['📻', '📃'],
    },
    {
      text: 'karaoke',
      category: WordCategory.MUSIC_CULTURE,
      sentenceHint: 'Singing along to famous songs with the lyrics on screen.',
      wordHints: ['sing', 'microphone', 'lyrics'],
      emojiHints: ['🎤', '🎵'],
    },
    {
      text: 'open mic',
      category: WordCategory.MUSIC_CULTURE,
      sentenceHint: 'An event where anyone can perform on stage.',
      wordHints: ['stage', 'anyone', 'perform'],
      emojiHints: ['🎙️', '⭐'],
    },
    {
      text: 'vinyl record',
      category: WordCategory.MUSIC_CULTURE,
      sentenceHint: 'A round black disc you play on a turntable.',
      wordHints: ['retro', 'turntable', 'analog'],
      emojiHints: ['💿', '🌀'],
    },

    // People & Roles
    {
      text: 'barista',
      category: WordCategory.PEOPLE_ROLES,
      sentenceHint: 'The person who prepares your coffee behind the counter.',
      wordHints: ['coffee', 'counter', 'expert'],
      emojiHints: ['👨‍🍳', '☕'],
    },
    {
      text: 'regular',
      category: WordCategory.PEOPLE_ROLES,
      sentenceHint: 'A guest who comes so often that staff know their order.',
      wordHints: ['often', 'same drink', 'familiar'],
      emojiHints: ['🔁', '🙂'],
    },
    {
      text: 'tourist',
      category: WordCategory.PEOPLE_ROLES,
      sentenceHint: 'A visitor exploring the city, often with a camera.',
      wordHints: ['camera', 'map', 'visiting'],
      emojiHints: ['🗺️', '📸'],
    },
    {
      text: 'student',
      category: WordCategory.PEOPLE_ROLES,
      sentenceHint: 'Someone studying with a laptop and notes on the table.',
      wordHints: ['study', 'laptop', 'exam'],
      emojiHints: ['🎓', '💻'],
    },
    {
      text: 'freelancer',
      category: WordCategory.PEOPLE_ROLES,
      sentenceHint: 'A person working remotely from cafés instead of an office.',
      wordHints: ['remote', 'client', 'laptop'],
      emojiHints: ['💻', '☕'],
    },
    {
      text: 'first date',
      category: WordCategory.PEOPLE_ROLES,
      sentenceHint: 'Two people meeting to see if there is a spark.',
      wordHints: ['nervous', 'romantic', 'coffee'],
      emojiHints: ['💘', '☕'],
    },
    {
      text: 'bartender',
      category: WordCategory.PEOPLE_ROLES,
      sentenceHint: 'The person who mixes your cocktails at night.',
      wordHints: ['cocktail', 'night', 'shaker'],
      emojiHints: ['🍹', '👨‍🍳'],
    },
    {
      text: 'DJ',
      category: WordCategory.PEOPLE_ROLES,
      sentenceHint: 'The person selecting and mixing music for the crowd.',
      wordHints: ['music', 'mix', 'deck'],
      emojiHints: ['🎧', '🎶'],
    },
    {
      text: 'waiter',
      category: WordCategory.PEOPLE_ROLES,
      sentenceHint: 'The person who brings your order to the table.',
      wordHints: ['tray', 'order', 'service'],
      emojiHints: ['🧾', '🧑‍🍳'],
    },
    {
      text: 'group chat',
      category: WordCategory.PEOPLE_ROLES,
      sentenceHint: 'A conversation with friends on your phone planning where to meet.',
      wordHints: ['friends', 'messages', 'plan'],
      emojiHints: ['💬', '👥'],
    },

    // Moments & Actions
    {
      text: 'last round',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'The final chance to order drinks before closing.',
      wordHints: ['closing', 'final', 'order'],
      emojiHints: ['⏰', '🍺'],
    },
    {
      text: 'happy hour',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'A time with special drink discounts, usually in the evening.',
      wordHints: ['discount', 'evening', 'drinks'],
      emojiHints: ['😊', '🍹'],
    },
    {
      text: 'coffee break',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'A short pause from work to grab a hot drink.',
      wordHints: ['pause', 'work', 'cup'],
      emojiHints: ['☕', '⏳'],
    },
    {
      text: 'study session',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'A block of time to focus on notes, books and laptops.',
      wordHints: ['focus', 'notes', 'books'],
      emojiHints: ['📚', '🧠'],
    },
    {
      text: 'after work',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'The time when colleagues grab a drink once the day is done.',
      wordHints: ['office', 'relax', 'evening'],
      emojiHints: ['🏢', '🍻'],
    },
    {
      text: 'birthday toast',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'Everyone raises glasses to celebrate someone’s special day.',
      wordHints: ['celebrate', 'cheers', 'cake'],
      emojiHints: ['🎂', '🥂'],
    },
    {
      text: 'small talk',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'Light conversation about the weather, work and daily life.',
      wordHints: ['casual', 'chat', 'surface'],
      emojiHints: ['💬', '🌤️'],
    },
    {
      text: 'deep talk',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'A long, honest conversation about feelings and life.',
      wordHints: ['serious', 'feelings', 'night'],
      emojiHints: ['🧠', '💬'],
    },
    {
      text: 'group selfie',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'Everyone squeezes into one photo taken with a phone.',
      wordHints: ['photo', 'friends', 'camera'],
      emojiHints: ['🤳', '👯'],
    },
    {
      text: 'card game',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'Friends playing with a deck on the table between drinks.',
      wordHints: ['deck', 'table', 'play'],
      emojiHints: ['🃏', '🪑'],
    },
    {
      text: 'cold brew',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'Coffee steeped in cold water for hours, served chilled.',
      wordHints: ['iced', 'slow', 'smooth'],
      emojiHints: ['🧊', '☕'],
    },
    {
      text: 'matcha',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'Bright green powdered tea whisked into hot water or milk.',
      wordHints: ['green', 'whisk', 'Japanese'],
      emojiHints: ['🍵', '🟩'],
    },
    {
      text: 'scone',
      category: WordCategory.DRINK_FOOD,
      sentenceHint: 'A crumbly baked good often served with jam and cream.',
      wordHints: ['tea', 'jam', 'British'],
      emojiHints: ['🥐', '🫖'],
    },
    {
      text: 'wifi password',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'What you ask the barista for to get online on your laptop.',
      wordHints: ['internet', 'network', 'login'],
      emojiHints: ['📶', '🔑'],
    },
    {
      text: 'brunch',
      category: WordCategory.MOMENTS_ACTIONS,
      sentenceHint: 'A late morning meal that mixes breakfast and lunch.',
      wordHints: ['weekend', 'eggs', 'mimosas'],
      emojiHints: ['🍳', '🥂'],
    },
    {
      text: 'open mic night',
      category: WordCategory.MUSIC_CULTURE,
      sentenceHint: 'An evening where anyone can sign up to perform.',
      wordHints: ['stage', 'signup', 'talent'],
      emojiHints: ['🎤', '🌙'],
    },
  ];

  await seedBrawlerPowerups(prisma);

  for (const word of words) {
    await prisma.word.upsert({
      where: { text_language: { text: word.text, language: 'en' } },
      update: {},
      create: {
        ...word,
        language: 'en',
      },
    });
  }

  await seedWordLocales(prisma);

  await seedVenueTaxonomy(prisma);

  await seedPilotVenues(prisma);

  // eslint-disable-next-line no-console
  console.log('Seeding demo players, social, games, partner data…');
  await seedDemoData(prisma);

  // MVP heroes for Brawler mode.
  // Stable IDs so seed remains idempotent across environments.
  const brawlerHeroes = [
    {
      id: 'hero_blaze',
      name: 'Gorgon',
      isActive: true,
      archetype: 'Bruiser',
      avatarImageUrl: 'https://cdn.playvibe.gg/heroes/blaze/avatar.webp',
      portraitImageUrl: 'https://cdn.playvibe.gg/heroes/blaze/portrait.webp',
      spriteSheetUrl: 'https://cdn.playvibe.gg/heroes/blaze/spritesheet.webp',
      spriteMeta: {
        frameWidth: 128,
        frameHeight: 128,
        fps: 12,
        animations: {
          idle: [0, 3],
          run: [4, 11],
          attack: [12, 17],
          dash: [18, 23],
          hit: [24, 27],
          ko: [28, 33],
        },
      },
      baseHp: 100,
      moveSpeed: 1.0,
      dashCooldownMs: 2200,
      attackDamage: 14,
      attackKnockback: 1.0,
      version: 1,
    },
    {
      id: 'hero_frost',
      name: 'Ignis',
      isActive: true,
      archetype: 'Mage',
      avatarImageUrl: 'https://cdn.playvibe.gg/heroes/frost/avatar.webp',
      portraitImageUrl: 'https://cdn.playvibe.gg/heroes/frost/portrait.webp',
      spriteSheetUrl: 'https://cdn.playvibe.gg/heroes/frost/spritesheet.webp',
      spriteMeta: {
        frameWidth: 128,
        frameHeight: 128,
        fps: 12,
        animations: { idle: [0, 3], run: [4, 11], attack: [12, 17], dash: [18, 23], hit: [24, 27], ko: [28, 33] },
      },
      baseHp: 96,
      moveSpeed: 1.03,
      dashCooldownMs: 2100,
      attackDamage: 13,
      attackKnockback: 1.02,
      version: 1,
    },
    {
      id: 'hero_bolt',
      name: 'Vespera',
      isActive: true,
      archetype: 'Assassin',
      avatarImageUrl: 'https://cdn.playvibe.gg/heroes/bolt/avatar.webp',
      portraitImageUrl: 'https://cdn.playvibe.gg/heroes/bolt/portrait.webp',
      spriteSheetUrl: 'https://cdn.playvibe.gg/heroes/bolt/spritesheet.webp',
      spriteMeta: {
        frameWidth: 128,
        frameHeight: 128,
        fps: 12,
        animations: { idle: [0, 3], run: [4, 11], attack: [12, 17], dash: [18, 23], hit: [24, 27], ko: [28, 33] },
      },
      baseHp: 92,
      moveSpeed: 1.08,
      dashCooldownMs: 1800,
      attackDamage: 12,
      attackKnockback: 0.95,
      version: 1,
    },
    {
      id: 'hero_echo',
      name: 'Echo',
      isActive: true,
      archetype: 'Trickster',
      avatarImageUrl: 'https://cdn.playvibe.gg/heroes/echo/avatar.webp',
      portraitImageUrl: 'https://cdn.playvibe.gg/heroes/echo/portrait.webp',
      spriteSheetUrl: 'https://cdn.playvibe.gg/heroes/echo/spritesheet.webp',
      spriteMeta: {
        frameWidth: 128,
        frameHeight: 128,
        fps: 12,
        animations: { idle: [0, 3], run: [4, 11], attack: [12, 17], dash: [18, 23], hit: [24, 27], ko: [28, 33] },
      },
      baseHp: 98,
      moveSpeed: 1.01,
      dashCooldownMs: 2000,
      attackDamage: 13,
      attackKnockback: 1.08,
      version: 1,
    },
    {
      id: 'hero_rift',
      name: 'Tariel',
      isActive: true,
      archetype: 'Tank',
      avatarImageUrl: 'https://cdn.playvibe.gg/heroes/rift/avatar.webp',
      portraitImageUrl: 'https://cdn.playvibe.gg/heroes/rift/portrait.webp',
      spriteSheetUrl: 'https://cdn.playvibe.gg/heroes/rift/spritesheet.webp',
      spriteMeta: {
        frameWidth: 128,
        frameHeight: 128,
        fps: 12,
        animations: { idle: [0, 3], run: [4, 11], attack: [12, 17], dash: [18, 23], hit: [24, 27], ko: [28, 33] },
      },
      baseHp: 112,
      moveSpeed: 0.94,
      dashCooldownMs: 2500,
      attackDamage: 15,
      attackKnockback: 1.12,
      version: 1,
    },
    {
      id: 'hero_nova',
      name: 'Nova',
      isActive: true,
      archetype: 'All-Rounder',
      avatarImageUrl: 'https://cdn.playvibe.gg/heroes/nova/avatar.webp',
      portraitImageUrl: 'https://cdn.playvibe.gg/heroes/nova/portrait.webp',
      spriteSheetUrl: 'https://cdn.playvibe.gg/heroes/nova/spritesheet.webp',
      spriteMeta: {
        frameWidth: 128,
        frameHeight: 128,
        fps: 12,
        animations: { idle: [0, 3], run: [4, 11], attack: [12, 17], dash: [18, 23], hit: [24, 27], ko: [28, 33] },
      },
      baseHp: 100,
      moveSpeed: 1.0,
      dashCooldownMs: 2100,
      attackDamage: 14,
      attackKnockback: 1.0,
      version: 1,
    },
  ];

  for (const hero of brawlerHeroes) {
    await prisma.brawlerHero.upsert({
      where: { id: hero.id },
      update: {
        name: hero.name,
        isActive: hero.isActive,
        archetype: hero.archetype ?? null,
        avatarImageUrl: hero.avatarImageUrl ?? null,
        portraitImageUrl: hero.portraitImageUrl ?? null,
        spriteSheetUrl: hero.spriteSheetUrl ?? null,
        spriteMeta: hero.spriteMeta,
        baseHp: hero.baseHp,
        moveSpeed: hero.moveSpeed,
        dashCooldownMs: hero.dashCooldownMs,
        attackDamage: hero.attackDamage,
        attackKnockback: hero.attackKnockback,
        version: hero.version,
      },
      create: hero,
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

