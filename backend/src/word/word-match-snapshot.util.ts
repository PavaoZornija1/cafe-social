import { GameSessionStatus, GameType } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

export type WordMatchLiveSnapshotV1 = {
  v: 1;
  /** Bumped on every Redis refresh (compare with client `If-Match` / local state later). */
  rev: number;
  sessionId: string;
  status: GameSessionStatus;
  mode: 'coop' | 'versus';
  difficulty: string;
  ranked: boolean;
  venueId: string | null;
  deckLanguage: string;
  deckCategory: string | null;
  hostPlayerId: string;
  inviteCode: string | null;
  targetWordCount: number;
  /** Deck order — lets `getDeck` avoid reloading `GameSession.config` from Postgres. */
  wordIds: string[];
  sharedWordIndex: number;
  wordsSolvedCount: number;
  startedAt: string | null;
  endedAt: string | null;
  participants: Array<{
    id: string;
    playerId: string | null;
    username: string;
    score: number;
    result: string | null;
  }>;
};

type WordMatchConfigJson = {
  wordGameMode?: 'coop' | 'versus';
  difficulty?: string;
  wordIds?: string[];
  hostPlayerId?: string;
  category?: string | null;
  ranked?: boolean;
};

function isParticipantActive(p: { playerId: string | null; leftAt: Date | null }): boolean {
  return Boolean(p.playerId && !p.leftAt);
}

/**
 * Loads the canonical word-match snapshot from Postgres (source of truth).
 * Used to hydrate / refresh Redis runtime mirrors.
 */
export async function loadWordMatchSnapshotFromDb(
  prisma: PrismaService,
  sessionId: string,
): Promise<WordMatchLiveSnapshotV1 | null> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      participants: { include: { player: { select: { id: true, username: true } } } },
      wordSession: true,
    },
  });
  if (!session || session.gameType !== GameType.WORD_GAME) return null;
  const config = session.config as unknown as WordMatchConfigJson;
  const ws = session.wordSession;
  const mode = config.wordGameMode === 'versus' ? 'versus' : 'coop';
  const wordIds = config.wordIds ?? [];
  return {
    v: 1,
    rev: 0,
    sessionId: session.id,
    status: session.status,
    mode,
    difficulty: config.difficulty ?? 'normal',
    ranked: Boolean(config.ranked),
    venueId: session.venueId,
    deckLanguage: ws?.language ?? 'en',
    deckCategory: (config.category ?? null) as string | null,
    hostPlayerId: config.hostPlayerId ?? '',
    inviteCode: session.inviteCode,
    targetWordCount: wordIds.length,
    wordIds,
    sharedWordIndex: ws?.sharedWordIndex ?? 0,
    wordsSolvedCount: ws?.wordsSolvedCount ?? 0,
    startedAt: session.startedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    participants: session.participants.filter(isParticipantActive).map((p) => ({
      id: p.id,
      playerId: p.playerId,
      username: p.displayNameSnapshot ?? p.player?.username ?? 'Player',
      score: p.score,
      result: p.result,
    })),
  };
}
