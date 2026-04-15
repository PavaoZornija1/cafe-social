/** Brawler hero combat fields (matches API / DB); passed into arena for local simulation. */
export type BrawlerArenaHeroStats = {
  baseHp: number;
  moveSpeed: number;
  dashCooldownMs: number;
  attackDamage: number;
  attackKnockback: number;
};

export type RootStackParamList = {
    Login: undefined;
    SignUp: undefined;
    Onboarding: undefined;
    Home: undefined;
    PartnerVenuesMap: undefined;
    DailyWord: undefined;
    ChooseGame: { venueId?: string; challengeId?: string } | undefined;
    BrawlerLobby: { venueId?: string } | undefined;
    BrawlerArena: {
      heroId: string;
      venueId?: string;
      heroStats?: BrawlerArenaHeroStats;
    };
    Challenges: undefined;
    Leaderboard: undefined;
    Profile: undefined;
    Friends: undefined;
    Settings: undefined;
    Parties: undefined;
    PartyDetail: { partyId: string };
    RedeemInvite: { token?: string } | undefined;
    RedeemPerk: { venueId?: string } | undefined;
    PeopleHere: { venueId: string; venueName?: string };
    ReportPlayer: {
        venueId: string;
        venueName?: string;
        reportedPlayerId: string;
        reportedUsername: string;
    };
    BanAppeal: { venueId: string; venueName?: string };
    QrScan: { venueId?: string };
    WordLobby: { venueId?: string; challengeId?: string };
    WordMatchJoin: { venueId?: string; challengeId?: string };
    WordMatchWait: {
      venueId?: string;
      challengeId?: string;
      mode: 'coop' | 'versus';
      difficulty: 'easy' | 'normal' | 'hard';
      create?: boolean;
      sessionId?: string;
    };
    WordGame: {
      venueId?: string;
      challengeId?: string;
      difficulty: 'easy' | 'normal' | 'hard';
      mode: 'solo' | 'coop' | 'versus';
      matchSessionId?: string;
      sessionWordsCount?: number;
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