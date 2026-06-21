/** Brawler hero combat fields (matches API / DB); passed into arena for local simulation. */
export type BrawlerArenaHeroStats = {
  baseHp: number;
  moveSpeed: number;
  dashCooldownMs: number;
  attackDamage: number;
  attackKnockback: number;
};

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
    BrawlerLobby: { venueId?: string } | undefined;
    /**
     * Cross-venue brawler matchmaking queue.
     * `venueId` is required for venue-presence players; subscribers may queue from anywhere
     * (omit `venueId` to skip the presence check).
     */
    BrawlerVenueQueue: {
      venueId?: string;
      brawlerHeroId: string;
      ranked?: boolean;
      /** Same tuning as Practice vs bot — forwarded to `BrawlerArena` on match. */
      heroStats?: BrawlerArenaHeroStats;
    };
    BrawlerArena: {
      heroId: string;
      venueId?: string;
      heroStats?: BrawlerArenaHeroStats;
      /** Present for server-tracked brawler matches (multiplayer / ranked). */
      sessionId?: string;
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
    PartyDetail: { partyId: string };
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
    WordLobby: { venueId?: string; challengeId?: string };
    /**
     * Cross-venue matchmaking queue (auto-pairs into a new word room).
     * `venueId` is required for venue-presence players; subscribers may queue from anywhere
     * (omit `venueId` to skip the presence check).
     */
    WordVenueQueue: {
      venueId?: string;
      challengeId?: string;
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
    StaffVenues: undefined;
    StaffRedemptions: {
      venueId: string;
      venueName?: string;
      /** 8-char hex staff code from QR / manual entry */
      highlightCode?: string;
    };
    StaffQrScan: { venueId: string; venueName?: string };
    SubmitReceipt: { venueId: string };
};