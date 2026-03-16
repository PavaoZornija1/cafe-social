import { PrismaClient, WordCategory } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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
  ];

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

