export type RootStackParamList = {
    Login: undefined;
    SignUp: undefined;
    Home: undefined;
    Challenges: undefined;
    Leaderboard: undefined;
    Profile: undefined;
    Settings: undefined;
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