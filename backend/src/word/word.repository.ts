import { Injectable } from '@nestjs/common';
import { Prisma, type Word, type WordCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { deterministicIndex } from '../lib/deterministic-index';

export type WordQuery = {
  language: string;
  category?: WordCategory;
  count: number;
  /** easy: shorter answers; hard: longer; normal: no length filter */
  difficulty?: string;
};

@Injectable()
export class WordRepository {
  constructor(private readonly prisma: PrismaService) {}

  private async randomDeckIds(params: WordQuery, limit: number): Promise<string[]> {
    const diff = params.difficulty ?? 'normal';
    const lenClause =
      diff === 'easy'
        ? Prisma.sql`AND char_length(text) <= 8`
        : diff === 'hard'
          ? Prisma.sql`AND char_length(text) >= 10`
          : Prisma.empty;
    const catClause =
      params.category != null
        ? Prisma.sql`AND category = ${params.category}::"WordCategory"`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Word"
      WHERE language = ${params.language}
      ${catClause}
      ${lenClause}
      ORDER BY random()
      LIMIT ${limit}
    `;
    return rows.map((r) => r.id);
  }

  async findRandomSessionDeck(params: WordQuery): Promise<Word[]> {
    const take = Math.max(1, params.count);
    let ids = await this.randomDeckIds(params, take);
    if (ids.length < take && params.difficulty && params.difficulty !== 'normal') {
      ids = await this.randomDeckIds({ ...params, difficulty: 'normal' }, take);
    }
    if (ids.length === 0) return [];

    const words = await this.prisma.word.findMany({
      where: { id: { in: ids } },
    });
    const byId = new Map(words.map((w) => [w.id, w]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as Word[];
  }

  /** Deterministic word for a calendar day + scope (global or venue). */
  async pickWordIdForDaily(language: string, dayKey: string, scopeKey: string): Promise<string | null> {
    const where: Prisma.WordWhereInput = { language };
    const total = await this.prisma.word.count({ where });
    if (total <= 0) return null;
    const idx = deterministicIndex(`${dayKey}|${scopeKey}|${language}|daily`, total);
    const rows = await this.prisma.word.findMany({
      where,
      select: { id: true },
      orderBy: [{ text: 'asc' }, { id: 'asc' }],
      skip: idx,
      take: 1,
    });
    return rows[0]?.id ?? null;
  }

  async getWordTextById(id: string): Promise<{ text: string } | null> {
    return this.prisma.word.findUnique({
      where: { id },
      select: { text: true },
    });
  }

  async findWordById(id: string): Promise<Word | null> {
    return this.prisma.word.findUnique({ where: { id } });
  }
}
