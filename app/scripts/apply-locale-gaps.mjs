/**
 * One-off sync: fill missing app locale keys (de/hr/es) from curated translations.
 * Run: node scripts/apply-locale-gaps.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/i18n/locales');

/** dot.path → { de, hr, es } */
const GAPS = {
  'venuePlayBar.gamesRemaining': {
    de: '{{n}} Spiele übrig',
    hr: '{{n}} igara preostalo',
    es: '{{n}} partidas restantes',
  },
  'chooseGame.heroTitle': {
    de: 'Wähle ein Spiel',
    hr: 'Odaberi igru',
    es: 'Elige un juego',
  },
  'chooseGame.heroVenue': {
    de: 'Du bist bei {{venue}} — Venue-Spiele nutzen dieses Café.',
    hr: 'Na lokaciji {{venue}} — igre u kafiću koriste ovaj lokal.',
    es: 'Estás en {{venue}} — los juegos del local usan este café.',
  },
  'chooseGame.heroGlobal': {
    de: 'Abonnent — spiele von überall.',
    hr: 'Pretplatnik — igraj s bilo kojeg mjesta.',
    es: 'Suscriptor — juega desde cualquier lugar.',
  },
  'staff.memberScanSuccessTitle': {
    de: 'Mitglied erkannt',
    hr: 'Član prepoznat',
    es: 'Miembro reconocido',
  },
  'staff.memberScanSuccessBody': {
    de: '{{username}} ist bei uns.',
    hr: '{{username}} je ovdje.',
    es: '{{username}} está aquí.',
  },
  'staff.lockReward': { de: 'Sperren', hr: 'Zaključaj', es: 'Bloquear' },
  'staff.unlockReward': { de: 'Entsperren', hr: 'Otključaj', es: 'Desbloquear' },
  'staff.voidReward': { de: 'Stornieren', hr: 'Poništi', es: 'Anular' },
  'staff.voidRewardTitle': {
    de: 'Belohnung stornieren?',
    hr: 'Poništiti nagradu?',
    es: '¿Anular recompensa?',
  },
  'staff.voidRewardHint': {
    de: 'Der Gast sieht die Belohnung als ungültig. Nur bei Missbrauch oder Fehlern nutzen.',
    hr: 'Gost će vidjeti nagradu kao nevažeću. Koristi samo za zloupotrebu ili greške.',
    es: 'El cliente verá la recompensa como inválida. Úsalo solo por abuso o errores.',
  },
  'staff.lockRewardTitle': {
    de: 'Belohnung sperren?',
    hr: 'Zaključati nagradu?',
    es: '¿Bloquear recompensa?',
  },
  'staff.lockRewardHint': {
    de: 'Der Code ist bis zur Freigabe verborgen.',
    hr: 'Kod je skriven dok se ne otključa.',
    es: 'El código queda oculto hasta desbloquear.',
  },
  'staff.lockReasonPlaceholder': {
    de: 'Grund (optional)',
    hr: 'Razlog (opcionalno)',
    es: 'Motivo (opcional)',
  },
  'staff.lockReasonRequired': {
    de: 'Gib einen Sperrgrund ein.',
    hr: 'Unesi razlog zaključavanja.',
    es: 'Introduce un motivo de bloqueo.',
  },
  'discoverHub.subscribersTitle': {
    de: 'Partner für Abonnenten',
    hr: 'Partneri za pretplatnike',
    es: 'Socios para suscriptores',
  },
  'discoverHub.subscribersEmpty': {
    de: 'Noch keine Abonnenten-Partner in deiner Nähe.',
    hr: 'Još nema partnerskih lokala za pretplatnike u blizini.',
    es: 'Aún no hay socios para suscriptores cerca.',
  },
  'venueHub.perkWalletCta': { de: 'Codes', hr: 'Kodovi', es: 'Códigos' },
  'venueHub.submitReceiptCta': {
    de: 'Beleg zur Prüfung einreichen',
    hr: 'Pošalji račun na pregled',
    es: 'Enviar recibo para revisión',
  },
  'profile.openQuestHub': {
    de: 'Belohnungs-Hub',
    hr: 'Centar nagrada',
    es: 'Centro de recompensas',
  },
  'profile.openPerkWallet': {
    de: 'Meine Perk-Codes',
    hr: 'Moji perk kodovi',
    es: 'Mis códigos de perks',
  },
  'profile.openMemberCard': {
    de: 'Mitgliedskarte',
    hr: 'Članska kartica',
    es: 'Tarjeta de miembro',
  },
  'profile.statsTitle': { de: 'Deine Stats', hr: 'Tvoja statistika', es: 'Tus estadísticas' },
  'profile.seeAllPerks': {
    de: 'Alle Belohnungen',
    hr: 'Sve nagrade',
    es: 'Todas las recompensas',
  },
  'parties.playTogether': {
    de: 'Gemeinsam spielen',
    hr: 'Igrajte zajedno',
    es: 'Jugar juntos',
  },
  'parties.playTogetherHint': {
    de: 'Lobby öffnen — im Chat abstimmen, dann Warteschlange oder Raum.',
    hr: 'Otvori predsoblje — dogovorite se u chatu, zatim red ili sobu.',
    es: 'Abre el lobby — coordinad en el chat y luego cola o sala.',
  },
  'parties.playAtVenue': {
    de: 'Erkannt bei {{venue}} — Venue-Spiele nutzen dieses Café.',
    hr: 'Prepoznato u {{venue}} — igre u kafiću koriste ovaj lokal.',
    es: 'Detectado en {{venue}} — los juegos del local usan este café.',
  },
  'parties.playGlobalSubscriber': {
    de: 'Abonnent — du kannst von überall spielen.',
    hr: 'Pretplatnik — možeš igrati s bilo kojeg mjesta.',
    es: 'Suscriptor — puedes jugar desde cualquier lugar.',
  },
  'parties.playNeedVenue': {
    de: 'In einem Partner-Café für Venue-Spiele oder mit Abo von überall.',
    hr: 'U partnerskom kafiću za igre ili s pretplatom s bilo kojeg mjesta.',
    es: 'En un café socio para juegos locales o con suscripción desde cualquier lugar.',
  },
  'parties.detailJustCreatedTitle': {
    de: 'Party erstellt',
    hr: 'Grupa je kreirana',
    es: 'Grupo creado',
  },
  'parties.detailJustCreatedHint': {
    de: 'Teile einen Einladungslink, dann wählt ihr unten ein Spiel.',
    hr: 'Podijeli pozivnicu, zatim odaberite igru ispod.',
    es: 'Comparte el enlace de invitación y luego elige un juego abajo.',
  },
  'parties.waitingForFriends': {
    de: 'Du bist allein — lade Freunde ein.',
    hr: 'Samo si ovdje — pozovi prijatelje.',
    es: 'Estás solo — invita a amigos.',
  },
  'parties.playWord': {
    de: 'Word-Match-Lobby',
    hr: 'Word match predsoblje',
    es: 'Lobby de word match',
  },
  'parties.playBrawler': {
    de: 'Brawler-Lobby',
    hr: 'Brawler predsoblje',
    es: 'Lobby de brawler',
  },
  'friends.subtitle': {
    de: 'Verbinde dich mit Leuten, mit denen du in Partner-Cafés spielst.',
    hr: 'Poveži se s ljudima s kojima igraš u partnerskim kafićima.',
    es: 'Conecta con personas con las que juegas en cafés socios.',
  },
  'perkWallet.statusLocked': {
    de: 'In Prüfung',
    hr: 'Na pregledu',
    es: 'En revisión',
  },
  'perkWallet.lockedHint': {
    de: 'Diese Belohnung ist gesperrt, bis das Personal einen Beleg oder ein Problem prüft.',
    hr: 'Nagrada je zaključana dok osoblje pregleda račun ili problem.',
    es: 'Esta recompensa está bloqueada mientras el personal revisa un recibo o incidencia.',
  },
  'perkWallet.refreshA11y': {
    de: 'Perk-Codes aktualisieren',
    hr: 'Osvježi perk kodove',
    es: 'Actualizar códigos de perks',
  },
  'perkWallet.submitReceiptToUnlock': {
    de: 'Beleg einreichen',
    hr: 'Pošalji račun',
    es: 'Enviar recibo',
  },
  'perkWallet.codeHidden': {
    de: 'Ausgeblendet',
    hr: 'Skriveno',
    es: 'Oculto',
  },
  'perk.needLocationPrecise': {
    de: 'Wir brauchen GPS, um die Venue-Zone zu bestätigen. Versuche es draußen oder am Fenster.',
    hr: 'Trebamo GPS da potvrdimo zonu kafića. Pokušaj vani ili kod prozora.',
    es: 'Necesitamos GPS para confirmar la zona del local. Prueba fuera o junto a una ventana.',
  },
  'perk.wrongVenue': {
    de: 'Du bist an einem anderen Ort als dieses Café. Geh zum richtigen Ort oder öffne Einlösen von Home.',
    hr: 'Na drugoj lokaciji nego ovaj kafić. Idi na pravi lokal ili otvori Iskoristi s početne.',
    es: 'Estás en un sitio distinto a este café. Ve al local correcto o abre Canjear desde Inicio.',
  },
  'perk.availableAtVenue': {
    de: 'Angebote in diesem Café',
    hr: 'Ponude u ovom kafiću',
    es: 'Ofertas en este café',
  },
  'perk.qrUnlockHint': {
    de: 'Check-in (QR oder Einladung) kann vor dem Einlösen nötig sein.',
    hr: 'Prijava (QR ili pozivnica) može biti potrebna prije iskorištavanja.',
    es: 'El check-in (QR o invitación) puede ser necesario antes de canjear.',
  },
  'perk.redeemedByYou': {
    de: 'Du hast dieses Angebot bereits eingelöst.',
    hr: 'Već si iskoristio/la ovu ponudu.',
    es: 'Ya canjeaste esta oferta.',
  },
  'perk.fullyRedeemedLabel': {
    de: 'Eingelöst',
    hr: 'Iskorišteno',
    es: 'Canjeado',
  },
  'receiptSubmit.linkedRewardHint': {
    de: 'Diese Belohnung wird bis zur Prüfung gesperrt.',
    hr: 'Ova nagrada bit će zaključana do pregleda.',
    es: 'Esta recompensa quedará bloqueada hasta la revisión.',
  },
  'banAppeal.outcomeTitleLifted': {
    de: 'Sperre aufgehoben',
    hr: 'Zabrana ukinuta',
    es: 'Prohibición levantada',
  },
  'banAppeal.outcomeTitleUpheld': {
    de: 'Sperre bleibt',
    hr: 'Zabrana ostaje',
    es: 'Prohibición mantenida',
  },
  'banAppeal.outcomeTitleDismissed': {
    de: 'Einspruch abgewiesen',
    hr: 'Žalba odbijena',
    es: 'Apelación rechazada',
  },
  'banAppeal.outcomeTitleOther': {
    de: 'Entscheidung',
    hr: 'Odluka',
    es: 'Decisión',
  },
  'banAppeal.outcomeBodyLifted': {
    de: 'Das Personal hat deine Sperre aufgehoben. Du kannst wieder teilnehmen.',
    hr: 'Osoblje je ukinulo zabranu. Možeš se ponovno pridružiti.',
    es: 'El personal levantó tu prohibición. Puedes volver a participar.',
  },
  'banAppeal.outcomeBodyUpheld': {
    de: 'Das Personal hat die Sperre bestätigt.',
    hr: 'Osoblje je potvrdilo zabranu.',
    es: 'El personal confirmó la prohibición.',
  },
  'banAppeal.outcomeBodyDismissed': {
    de: 'Dein Einspruch wurde ohne Änderung geschlossen.',
    hr: 'Tvoja žalba je zatvorena bez promjene.',
    es: 'Tu apelación se cerró sin cambios.',
  },
  'banAppeal.outcomeBodyOther': {
    de: 'Das Personal hat deinen Einspruch bearbeitet.',
    hr: 'Osoblje je obradilo tvoju žalbu.',
    es: 'El personal revisó tu apelación.',
  },
  'banAppeal.staffMessageLabel': {
    de: 'Nachricht vom Personal',
    hr: 'Poruka osoblja',
    es: 'Mensaje del personal',
  },
  'banAppeal.resolvedAt': {
    de: 'Bearbeitet {{when}}',
    hr: 'Riješeno {{when}}',
    es: 'Resuelto {{when}}',
  },
  'banAppeal.refresh': { de: 'Aktualisieren', hr: 'Osvježi', es: 'Actualizar' },
  'banAppeal.pendingTitle': {
    de: 'Einspruch läuft',
    hr: 'Žalba u tijeku',
    es: 'Apelación en curso',
  },
  'banAppeal.pendingBody': {
    de: 'Das Personal prüft deinen Einspruch. Wir benachrichtigen dich.',
    hr: 'Osoblje pregledava žalbu. Obavijestit ćemo te.',
    es: 'El personal revisa tu apelación. Te avisaremos.',
  },
  'brawlerArena.leaveTitle': {
    de: 'Arena verlassen?',
    hr: 'Napustiti arenu?',
    es: '¿Salir de la arena?',
  },
  'brawlerArena.leaveBody': {
    de: 'Dein aktuelles Match endet, wenn du jetzt gehst.',
    hr: 'Trenutna utakmica završava ako sada odeš.',
    es: 'Tu partida actual terminará si sales ahora.',
  },
  'brawlerArena.leave': { de: 'Verlassen', hr: 'Napusti', es: 'Salir' },
  'brawlerArena.cancel': { de: 'Abbrechen', hr: 'Odustani', es: 'Cancelar' },
};

function setPath(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const enExtra = {
  'perkWallet.submitReceiptToUnlock': 'Submit receipt',
  'perkWallet.codeHidden': 'Hidden',
  'receiptSubmit.linkedRewardHint':
    'This reward will be locked until staff review your receipt.',
  'brawlerArena.leaveTitle': 'Leave arena?',
  'brawlerArena.leaveBody': 'Your current match will end if you leave now.',
  'brawlerArena.leave': 'Leave',
  'brawlerArena.cancel': 'Cancel',
};

const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
for (const [k, v] of Object.entries(enExtra)) setPath(en, k, v);
fs.writeFileSync(path.join(localesDir, 'en.json'), `${JSON.stringify(en, null, 2)}\n`);

for (const loc of ['de', 'hr', 'es']) {
  const file = path.join(localesDir, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [dotPath, tr] of Object.entries(GAPS)) {
    setPath(data, dotPath, tr[loc]);
  }
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Updated ${loc}.json`);
}
