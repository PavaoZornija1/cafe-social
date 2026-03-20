export type RootStackParamList = {
    Login: undefined;
    SignUp: undefined;
    Home: undefined;
    ChooseGame: { venueId?: string; challengeId?: string } | undefined;
    BrawlerLobby: { venueId?: string } | undefined;
    BrawlerArena: { heroId: string; venueId?: string };
    Challenges: undefined;
    Leaderboard: undefined;
    Profile: undefined;
    Friends: undefined;
    Settings: undefined;
    Parties: undefined;
    PartyDetail: { partyId: string };
    RedeemInvite: { token?: string } | undefined;
    PeopleHere: { venueId: string; venueName?: string };
    QrScan: { venueId?: string };
    WordLobby: { venueId: string; challengeId?: string };
    WordGame: {
      venueId: string;
      challengeId?: string;
      difficulty: 'easy' | 'normal' | 'hard';
      mode: 'solo';
      sessionWordsCount?: number;
    };
};