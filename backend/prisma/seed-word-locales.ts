import type { PrismaClient } from '@prisma/client';
import { WordCategory } from '@prisma/client';

type Loc = {
  text: string;
  sentenceHint: string;
  wordHints: string[];
  emojiHints: string[];
};

/** Same café theme as EN seed; answers + hints localized for hr / de / es. */
const BUNDLES: Array<{ category: WordCategory; hr: Loc; de: Loc; es: Loc }> = [
  {
    category: WordCategory.DRINK_FOOD,
    hr: {
      text: 'espresso',
      sentenceHint: 'Mala, jaka šalica kave koja se služi u minijaturnoj šalici.',
      wordHints: ['jaka', 'šut', 'mala šalica', 'kava'],
      emojiHints: ['☕', '💥'],
    },
    de: {
      text: 'espresso',
      sentenceHint: 'Ein kleiner, starker Kaffee in einer winzigen Tasse.',
      wordHints: ['stark', 'shot', 'kleine Tasse', 'Kaffee'],
      emojiHints: ['☕', '💥'],
    },
    es: {
      text: 'espresso',
      sentenceHint: 'Un café pequeño y fuerte que se sirve en una taza diminuta.',
      wordHints: ['fuerte', 'café', 'taza pequeña'],
      emojiHints: ['☕', '💥'],
    },
  },
  {
    category: WordCategory.DRINK_FOOD,
    hr: {
      text: 'cappuccino',
      sentenceHint: 'Kava s pjenastim mlijekom i slojem pjene na vrhu.',
      wordHints: ['pjena', 'mlijeko', 'kava'],
      emojiHints: ['☕', '🫧'],
    },
    de: {
      text: 'cappuccino',
      sentenceHint: 'Kaffee mit aufgeschäumter Milch und einer dicken Schaumkrone.',
      wordHints: ['Schaum', 'Milch', 'Kaffee'],
      emojiHints: ['☕', '🫧'],
    },
    es: {
      text: 'capuchino',
      sentenceHint: 'Café con leche espumada y una capa espesa de espuma arriba.',
      wordHints: ['espuma', 'leche', 'café'],
      emojiHints: ['☕', '🫧'],
    },
  },
  {
    category: WordCategory.DRINK_FOOD,
    hr: {
      text: 'latte',
      sentenceHint: 'Velika, mliječna kava, često s umjetnošću u pjenu.',
      wordHints: ['mlijeko', 'velika šalica', 'umjetnost'],
      emojiHints: ['☕', '🎨'],
    },
    de: {
      text: 'latte',
      sentenceHint: 'Ein großer, milchiger Kaffee, oft mit Latte Art.',
      wordHints: ['Milch', 'große Tasse', 'Kunst'],
      emojiHints: ['☕', '🎨'],
    },
    es: {
      text: 'latte',
      sentenceHint: 'Café grande y lechoso, a veces con dibujo en la espuma.',
      wordHints: ['leche', 'taza grande', 'arte'],
      emojiHints: ['☕', '🎨'],
    },
  },
  {
    category: WordCategory.DRINK_FOOD,
    hr: {
      text: 'kroasan',
      sentenceHint: 'Hrskava, maslana peciva koja se često jede za doručak.',
      wordHints: ['maslac', 'pecivo', 'doručak'],
      emojiHints: ['🥐', '☕'],
    },
    de: {
      text: 'croissant',
      sentenceHint: 'Ein blättriges, buttriges Gebäck, oft zum Frühstück.',
      wordHints: ['Butter', 'Gebäck', 'Frühstück'],
      emojiHints: ['🥐', '☕'],
    },
    es: {
      text: 'cruasán',
      sentenceHint: 'Un bollo hojaldrado y mantecoso que suele desayunarse.',
      wordHints: ['mantequilla', 'hojaldre', 'desayuno'],
      emojiHints: ['🥐', '☕'],
    },
  },
  {
    category: WordCategory.DRINK_FOOD,
    hr: {
      text: 'ledena kava',
      sentenceHint: 'Hladna kava preko leda, savršena za vruće dane.',
      wordHints: ['hladno', 'led', 'ljeto'],
      emojiHints: ['🧊', '☕', '🌞'],
    },
    de: {
      text: 'eiskaffee',
      sentenceHint: 'Kalter Kaffee mit Eis, perfekt für heiße Tage.',
      wordHints: ['kalt', 'Eis', 'Sommer'],
      emojiHints: ['🧊', '☕', '🌞'],
    },
    es: {
      text: 'café helado',
      sentenceHint: 'Café frío con hielo, ideal para días calurosos.',
      wordHints: ['frío', 'hielo', 'verano'],
      emojiHints: ['🧊', '☕', '🌞'],
    },
  },
  {
    category: WordCategory.DRINK_FOOD,
    hr: {
      text: 'limunada',
      sentenceHint: 'Slatko-kiselo piće od limuna, šećera i vode.',
      wordHints: ['limun', 'slatko', 'kiselo'],
      emojiHints: ['🍋', '🥤'],
    },
    de: {
      text: 'limonade',
      sentenceHint: 'Ein süß-saures Getränk aus Zitronen, Zucker und Wasser.',
      wordHints: ['Zitrone', 'süß', 'sauer'],
      emojiHints: ['🍋', '🥤'],
    },
    es: {
      text: 'limonada',
      sentenceHint: 'Bebida agridulce hecha con limones, azúcar y agua.',
      wordHints: ['limón', 'dulce', 'ácido'],
      emojiHints: ['🍋', '🥤'],
    },
  },
  {
    category: WordCategory.PLACE_ATMOSPHERE,
    hr: {
      text: 'mjesto kraj prozora',
      sentenceHint: 'Sjedište uz staklo s pogledom na ulicu.',
      wordHints: ['pogled', 'staklo', 'ulica'],
      emojiHints: ['🪟', '👀'],
    },
    de: {
      text: 'fensterplatz',
      sentenceHint: 'Ein Platz am Glas mit Blick auf die Straße.',
      wordHints: ['Aussicht', 'Glas', 'draußen'],
      emojiHints: ['🪟', '👀'],
    },
    es: {
      text: 'mesa junto a la ventana',
      sentenceHint: 'Un sitio al lado del cristal para mirar la calle.',
      wordHints: ['vista', 'cristal', 'calle'],
      emojiHints: ['🪟', '👀'],
    },
  },
  {
    category: WordCategory.PLACE_ATMOSPHERE,
    hr: {
      text: 'terasa',
      sentenceHint: 'Vanjsko sjedenje kafića ili restorana.',
      wordHints: ['vani', 'stolovi', 'sunce'],
      emojiHints: ['☀️', '🪑'],
    },
    de: {
      text: 'terrasse',
      sentenceHint: 'Ein Außenbereich von Café oder Bar mit Tischen.',
      wordHints: ['draußen', 'Tische', 'Sonne'],
      emojiHints: ['☀️', '🪑'],
    },
    es: {
      text: 'terraza',
      sentenceHint: 'Zona exterior de un café o bar con mesas.',
      wordHints: ['fuera', 'mesas', 'sol'],
      emojiHints: ['☀️', '🪑'],
    },
  },
  {
    category: WordCategory.MOMENTS_ACTIONS,
    hr: {
      text: 'happy hour',
      sentenceHint: 'Vrijeme s posebnim popustima na pića, obično navečer.',
      wordHints: ['popust', 'večer', 'pića'],
      emojiHints: ['😊', '🍹'],
    },
    de: {
      text: 'happy hour',
      sentenceHint: 'Eine Zeit mit Sonderpreisen für Getränke, oft am Abend.',
      wordHints: ['Rabatt', 'Abend', 'Getränke'],
      emojiHints: ['😊', '🍹'],
    },
    es: {
      text: 'hora feliz',
      sentenceHint: 'Momento con descuentos en bebidas, suele ser por la tarde.',
      wordHints: ['descuento', 'tarde', 'bebidas'],
      emojiHints: ['😊', '🍹'],
    },
  },
  {
    category: WordCategory.MOMENTS_ACTIONS,
    hr: {
      text: 'kratki razgovor',
      sentenceHint: 'Lagani razgovor o vremenu, poslu i svakodnevici.',
      wordHints: ['neformalno', 'ćaskanje', 'površno'],
      emojiHints: ['💬', '🌤️'],
    },
    de: {
      text: 'smalltalk',
      sentenceHint: 'Leichte Gespräche über Wetter, Arbeit und Alltag.',
      wordHints: ['locker', 'plaudern', 'oberflächlich'],
      emojiHints: ['💬', '🌤️'],
    },
    es: {
      text: 'charla ligera',
      sentenceHint: 'Conversación casual sobre el tiempo, el trabajo y el día a día.',
      wordHints: ['casual', 'charlar', 'superficial'],
      emojiHints: ['💬', '🌤️'],
    },
  },
  {
    category: WordCategory.MUSIC_CULTURE,
    hr: {
      text: 'playlista',
      sentenceHint: 'Popis pjesama koji netko pusti u kafiću ili kod kuće.',
      wordHints: ['pjesme', 'redoslijed', 'streaming'],
      emojiHints: ['🎧', '📝'],
    },
    de: {
      text: 'playlist',
      sentenceHint: 'Eine Liste von Songs, die jemand im Café oder zu Hause abspielt.',
      wordHints: ['Songs', 'Reihenfolge', 'Streaming'],
      emojiHints: ['🎧', '📝'],
    },
    es: {
      text: 'lista de reproducción',
      sentenceHint: 'Lista de canciones que alguien pone en el café o en casa.',
      wordHints: ['canciones', 'orden', 'streaming'],
      emojiHints: ['🎧', '📝'],
    },
  },
  {
    category: WordCategory.PEOPLE_ROLES,
    hr: {
      text: 'barista',
      sentenceHint: 'Osoba koja priprema specijalitete od kave iza šanka.',
      wordHints: ['kava', 'šank', 'umijeće'],
      emojiHints: ['☕', '👩‍🍳'],
    },
    de: {
      text: 'barista',
      sentenceHint: 'Jemand, der hinter der Theke Kaffeespezialitäten zubereitet.',
      wordHints: ['Kaffee', 'Theke', 'Handwerk'],
      emojiHints: ['☕', '👩‍🍳'],
    },
    es: {
      text: 'barista',
      sentenceHint: 'Persona que prepara especialidades de café tras la barra.',
      wordHints: ['café', 'barra', 'oficio'],
      emojiHints: ['☕', '👩‍🍳'],
    },
  },
  {
    category: WordCategory.MOMENTS_ACTIONS,
    hr: {
      text: 'pauza za kavu',
      sentenceHint: 'Kratka stanke s posla za topli napitek.',
      wordHints: ['pauza', 'posao', 'šalica'],
      emojiHints: ['☕', '⏳'],
    },
    de: {
      text: 'kaffeepause',
      sentenceHint: 'Eine kurze Arbeitspause für ein heißes Getränk.',
      wordHints: ['Pause', 'Arbeit', 'Tasse'],
      emojiHints: ['☕', '⏳'],
    },
    es: {
      text: 'pausa para el café',
      sentenceHint: 'Un descanso breve del trabajo para tomar algo caliente.',
      wordHints: ['pausa', 'trabajo', 'taza'],
      emojiHints: ['☕', '⏳'],
    },
  },
  {
    category: WordCategory.DRINK_FOOD,
    hr: {
      text: 'biljni čaj',
      sentenceHint: 'Toplo piće od bilja i cvijeća, bez kofeina.',
      wordHints: ['bilje', 'opuštanje', 'bez kofeina'],
      emojiHints: ['🍵', '🌿'],
    },
    de: {
      text: 'kräutertee',
      sentenceHint: 'Ein warmes Getränk aus Kräutern und Blüten, ohne Koffein.',
      wordHints: ['Kräuter', 'entspannen', 'koffeinfrei'],
      emojiHints: ['🍵', '🌿'],
    },
    es: {
      text: 'té de hierbas',
      sentenceHint: 'Bebida caliente de hierbas y flores, sin cafeína.',
      wordHints: ['hierbas', 'relajar', 'sin cafeína'],
      emojiHints: ['🍵', '🌿'],
    },
  },
  {
    category: WordCategory.PEOPLE_ROLES,
    hr: {
      text: 'konobar',
      sentenceHint: 'Osoba koja prima narudžbe i donosi pića i jelo.',
      wordHints: ['posluživanje', 'šank', 'narudžba'],
      emojiHints: ['🍽️', '🧑‍🍳'],
    },
    de: {
      text: 'kellner',
      sentenceHint: 'Jemand, der Bestellungen aufnimmt und Getränke bringt.',
      wordHints: ['Bedienung', 'Theke', 'Bestellung'],
      emojiHints: ['🍽️', '🧑‍🍳'],
    },
    es: {
      text: 'camarero',
      sentenceHint: 'Persona que toma comandas y sirve bebidas y platos.',
      wordHints: ['servicio', 'barra', 'pedido'],
      emojiHints: ['🍽️', '🧑‍🍳'],
    },
  },
  {
    category: WordCategory.DRINK_FOOD,
    hr: {
      text: 'muffin',
      sentenceHint: 'Slatko pecivo, često s borovnicama ili čokoladom.',
      wordHints: ['pecivo', 'doručak', 'slatko'],
      emojiHints: ['🧁', '🫐'],
    },
    de: {
      text: 'muffin',
      sentenceHint: 'Ein kleines süßes Gebäck, oft mit Blaubeeren oder Schokolade.',
      wordHints: ['Gebäck', 'Frühstück', 'süß'],
      emojiHints: ['🧁', '🫐'],
    },
    es: {
      text: 'muffin',
      sentenceHint: 'Repostería dulce, a menudo con arándanos o chocolate.',
      wordHints: ['repostería', 'desayuno', 'dulce'],
      emojiHints: ['🧁', '🫐'],
    },
  },
  {
    category: WordCategory.DRINK_FOOD,
    hr: {
      text: 'americano',
      sentenceHint: 'Topla voda dodana espressu za blaži okus.',
      wordHints: ['espresso', 'voda', 'blago'],
      emojiHints: ['☕', '💧'],
    },
    de: {
      text: 'americano',
      sentenceHint: 'Heißes Wasser zum Espresso für einen milderen Geschmack.',
      wordHints: ['Espresso', 'Wasser', 'mild'],
      emojiHints: ['☕', '💧'],
    },
    es: {
      text: 'americano',
      sentenceHint: 'Agua caliente al espresso para un sabor más suave.',
      wordHints: ['espresso', 'agua', 'suave'],
      emojiHints: ['☕', '💧'],
    },
  },
  {
    category: WordCategory.PLACE_ATMOSPHERE,
    hr: {
      text: 'šank',
      sentenceHint: 'Površina gdje se naručuje i služe pića u kafiću.',
      wordHints: ['naručiti', 'bar', 'poslužitelj'],
      emojiHints: ['🍸', '🪑'],
    },
    de: {
      text: 'theke',
      sentenceHint: 'Die Fläche, an der man bestellt und Getränke bekommt.',
      wordHints: ['bestellen', 'Bar', 'Service'],
      emojiHints: ['🍸', '🪑'],
    },
    es: {
      text: 'barra',
      sentenceHint: 'Superficie donde pides y te sirven bebidas en un café.',
      wordHints: ['pedir', 'bar', 'servicio'],
      emojiHints: ['🍸', '🪑'],
    },
  },
  {
    category: WordCategory.MOMENTS_ACTIONS,
    hr: {
      text: 'za ponijeti',
      sentenceHint: 'Hrana ili piće koje uzmeš s sobom iz kafića.',
      wordHints: ['kutija', 'papirnata vrećica', 'odlazak'],
      emojiHints: ['🥡', '🚶'],
    },
    de: {
      text: 'zum mitnehmen',
      sentenceHint: 'Essen oder Getränk, das du aus dem Café mitnimmst.',
      wordHints: ['Box', 'Beutel', 'mitgehen'],
      emojiHints: ['🥡', '🚶'],
    },
    es: {
      text: 'para llevar',
      sentenceHint: 'Comida o bebida que te llevas del café.',
      wordHints: ['caja', 'bolsa', 'salir'],
      emojiHints: ['🥡', '🚶'],
    },
  },
  {
    category: WordCategory.MUSIC_CULTURE,
    hr: {
      text: 'živa glazba',
      sentenceHint: 'Izvođači s instrumentima uživo u prostoru kafića.',
      wordHints: ['bend', 'scena', 'večer'],
      emojiHints: ['🎸', '🎤'],
    },
    de: {
      text: 'livemusik',
      sentenceHint: 'Musiker mit Instrumenten direkt im Café.',
      wordHints: ['Band', 'Bühne', 'Abend'],
      emojiHints: ['🎸', '🎤'],
    },
    es: {
      text: 'música en vivo',
      sentenceHint: 'Músicos con instrumentos tocando en el local.',
      wordHints: ['banda', 'escenario', 'noche'],
      emojiHints: ['🎸', '🎤'],
    },
  },
  {
    category: WordCategory.DRINK_FOOD,
    hr: {
      text: 'hladna kava',
      sentenceHint: 'Kava koja se dugo macera u hladnoj vodi, služi se hladna.',
      wordHints: ['led', 'sporo', 'glatko'],
      emojiHints: ['🧊', '☕'],
    },
    de: {
      text: 'cold brew',
      sentenceHint: 'Kaffee, der stundenlang in kaltem Wasser zieht, kalt serviert.',
      wordHints: ['Eis', 'langsam', 'mild'],
      emojiHints: ['🧊', '☕'],
    },
    es: {
      text: 'cold brew',
      sentenceHint: 'Café infusionado en agua fría durante horas, servido frío.',
      wordHints: ['hielo', 'lento', 'suave'],
      emojiHints: ['🧊', '☕'],
    },
  },
  {
    category: WordCategory.DRINK_FOOD,
    hr: {
      text: 'matcha',
      sentenceHint: 'Zeleni čaj u prahu umiješan u vruću vodu ili mlijeko.',
      wordHints: ['zeleno', 'metlica', 'Japan'],
      emojiHints: ['🍵', '🟩'],
    },
    de: {
      text: 'matcha',
      sentenceHint: 'Grüner Teepulver, mit heißem Wasser oder Milch aufgeschäumt.',
      wordHints: ['grün', 'Bambus', 'Japan'],
      emojiHints: ['🍵', '🟩'],
    },
    es: {
      text: 'matcha',
      sentenceHint: 'Té verde en polvo batido con agua o leche caliente.',
      wordHints: ['verde', 'batidor', 'Japón'],
      emojiHints: ['🍵', '🟩'],
    },
  },
  {
    category: WordCategory.MOMENTS_ACTIONS,
    hr: {
      text: 'brunch',
      sentenceHint: 'Kasni doručak koji spaja jutarnje i ručak jelo.',
      wordHints: ['vikend', 'jaja', 'mimosas'],
      emojiHints: ['🍳', '🥂'],
    },
    de: {
      text: 'brunch',
      sentenceHint: 'Spätes Frühstück, das Frühstück und Mittagessen verbindet.',
      wordHints: ['Wochenende', 'Eier', 'Mimosas'],
      emojiHints: ['🍳', '🥂'],
    },
    es: {
      text: 'brunch',
      sentenceHint: 'Comida tardía que mezcla desayuno y almuerzo.',
      wordHints: ['fin de semana', 'huevos', 'mimosas'],
      emojiHints: ['🍳', '🥂'],
    },
  },
  {
    category: WordCategory.MOMENTS_ACTIONS,
    hr: {
      text: 'wifi lozinka',
      sentenceHint: 'Ono što tražiš od osoblja da bi se spojio na internet.',
      wordHints: ['internet', 'mreža', 'prijava'],
      emojiHints: ['📶', '🔑'],
    },
    de: {
      text: 'wlan passwort',
      sentenceHint: 'Das, was du vom Personal brauchst, um online zu gehen.',
      wordHints: ['Internet', 'Netzwerk', 'Login'],
      emojiHints: ['📶', '🔑'],
    },
    es: {
      text: 'contraseña wifi',
      sentenceHint: 'Lo que pides para conectar tu portátil a internet.',
      wordHints: ['internet', 'red', 'acceso'],
      emojiHints: ['📶', '🔑'],
    },
  },
];

export async function seedWordLocales(prisma: PrismaClient): Promise<void> {
  const langs = ['hr', 'de', 'es'] as const;
  for (const bundle of BUNDLES) {
    for (const lang of langs) {
      const w = bundle[lang];
      await prisma.word.upsert({
        where: {
          text_language: { text: w.text, language: lang },
        },
        update: {
          category: bundle.category,
          sentenceHint: w.sentenceHint,
          wordHints: w.wordHints,
          emojiHints: w.emojiHints,
        },
        create: {
          text: w.text,
          language: lang,
          category: bundle.category,
          sentenceHint: w.sentenceHint,
          wordHints: w.wordHints,
          emojiHints: w.emojiHints,
        },
      });
    }
  }
}
