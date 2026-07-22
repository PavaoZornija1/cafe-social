/** Brawler hero combat fields (matches API / DB); passed into arena for local simulation. */
export type BrawlerArenaHeroStats = {
  baseHp: number;
  moveSpeed: number;
  dashCooldownMs: number;
  attackDamage: number;
  attackKnockback: number;
};

/** Concrete arena backdrop pack (see `arenaMaps.ts`). */
export type BrawlerArenaMapId = 'mossy_cavern' | 'desert_plains';

export type { MainTabParamList } from './mainTabsRoutes';

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MainTabParamList } from './mainTabsRoutes';

export type RootStackParamList = {
    Login: undefined;
    SignUp: undefined;
    Onboarding: undefined;
    /** Signed-in shell: Home · Play · Venues · Friends · Me */
    MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
    VenueHub: { venueId: string; venueName?: string };
    DiscoverHub: undefined;
    DailyWord: undefined;
    ChooseGame: { venueId?: string; challengeId?: string } | undefined;
    BrawlerLobby: { venueId?: string; partyId?: string } | undefined;
    /**
     * Cross-venue brawler matchmaking queue.
     * `venueId` is required for venue-presence players; subscribers may queue from anywhere
     * (omit `venueId` to skip the presence check).
     */
    BrawlerVenueQueue: {
      venueId?: string;
      partyId?: string;
      brawlerHeroId: string;
      heroName?: string;
      ranked?: boolean;
      /** Same tuning as Practice vs bot — forwarded to `BrawlerArena` on match. */
      heroStats?: BrawlerArenaHeroStats;
      /** Resolved map for this match (lobby may pick or roll randomly). */
      mapId?: BrawlerArenaMapId;
    };
    BrawlerArena: {
      /** Required for local/solo; may be omitted when resuming a server session from a push. */
      heroId?: string;
      venueId?: string;
      heroStats?: BrawlerArenaHeroStats;
      /** Present for server-tracked brawler matches (multiplayer / ranked). */
      sessionId?: string;
      /** Arena backdrop pack; defaults to mossy_cavern when omitted. */
      mapId?: BrawlerArenaMapId;
      soloOptions?: {
        opponentCount: number;
        difficulty: 'easy' | 'normal' | 'hard';
      };
    };
    Challenges: { venueId?: string; venueName?: string } | undefined;
    Leaderboard:
        | { venueId?: string; venueName?: string; scope?: 'venue' | 'city' | 'country' | 'global' }
        | undefined;
    Friends: undefined;
    Settings: undefined;
    MemberCard: undefined;
    FriendCard: undefined;
    ScanFriendQr: undefined;
    Parties: undefined;
    PartyDetail: { partyId: string; justCreated?: boolean };
    RedeemInvite: { token?: string } | undefined;
    RedeemPerk: { venueId?: string } | undefined;
    RewardsHub: undefined;
    PerkWallet: undefined;
    PeopleHere: { venueId: string; venueName?: string };
    ReportPlayer: {
        venueId: string;
        venueName?: string;
        reportedPlayerId: string;
        reportedUsername: string;
    };
    BanAppeal: { venueId: string; venueName?: string; focusAppealId?: string };
    MyVenueReports: undefined;
    QrScan: { venueId?: string };
    WordLobby: { venueId?: string; challengeId?: string; partyId?: string };
    /**
     * Cross-venue matchmaking queue (auto-pairs into a new word room).
     * `venueId` is required for venue-presence players; subscribers may queue from anywhere
     * (omit `venueId` to skip the presence check).
     */
    WordVenueQueue: {
      venueId?: string;
      challengeId?: string;
      partyId?: string;
      mode: 'coop' | 'versus';
      difficulty: 'easy' | 'normal' | 'hard';
      wordCount: number;
      wordCategory?: string;
      ranked?: boolean;
    };
    WordMatchJoin: { venueId?: string; challengeId?: string };
    WordMatchWait: {
      venueId?: string;
      challengeId?: string;
      partyId?: string;
      mode: 'coop' | 'versus';
      difficulty: 'easy' | 'normal' | 'hard';
      create?: boolean;
      sessionId?: string;
      /** Host create only — passed to POST /words/matches */
      wordCount?: number;
      wordCategory?: string;
      /** Versus only — ranked match (rating changes on finish). */
      ranked?: boolean;
    };
    WordGame: {
      venueId?: string;
      challengeId?: string;
      difficulty: 'easy' | 'normal' | 'hard';
      mode: 'solo' | 'coop' | 'versus';
      matchSessionId?: string;
      sessionWordsCount?: number;
      /** Solo — filters POST /words/session/start */
      wordCategory?: string;
      /** From server state for versus ranked. */
      ranked?: boolean;
    };
    /**
     * Short intro before WordGame / BrawlerArena: transition stinger + game music,
     * then auto-advances into the match.
     */
    GameLaunch:
      | {
          kind: 'word';
          players?: { username: string; isYou?: boolean }[];
          word: {
            venueId?: string;
            challengeId?: string;
            difficulty: 'easy' | 'normal' | 'hard';
            mode: 'solo' | 'coop' | 'versus';
            matchSessionId?: string;
            sessionWordsCount?: number;
            wordCategory?: string;
            ranked?: boolean;
          };
        }
      | {
          kind: 'brawler';
          players?: { username: string; isYou?: boolean }[];
          brawler: {
            heroId?: string;
            venueId?: string;
            heroStats?: BrawlerArenaHeroStats;
            sessionId?: string;
            mapId?: BrawlerArenaMapId;
            soloOptions?: {
              opponentCount: number;
              difficulty: 'easy' | 'normal' | 'hard';
            };
          };
        };
    StaffVenues: undefined;
    StaffRedemptions: {
      venueId: string;
      venueName?: string;
      /** 8-char hex staff code from QR / manual entry */
      highlightCode?: string;
    };
    StaffQrScan: { venueId: string; venueName?: string };
    SubmitReceipt: { venueId: string; redemptionId?: string };
};