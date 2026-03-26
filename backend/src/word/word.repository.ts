import { Injectable } from '@nestjs/common';
import type { Prisma, Word, WordCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { deterministicIndex } from '../lib/deterministic-index';

export type WordQuery = {
  language: string;
  category?: WordCategory;
  count: number;
};

@Injectable()
export class WordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRandomSessionDeck(params: WordQuery): Promise<Word[]> {
    const where: Prisma.WordWhereInput = {
      language: params.language,
      ...(params.category ? { category: params.category } : {}),
    };

    const total = await this.prisma.word.count({ where });
    if (total <= 0) return [];

    const take = Math.min(params.count, total);
    const maxSkip = Math.max(0, total - take);
    const skip = Math.floor(Math.random() * (maxSkip + 1));

    return this.prisma.word.findMany({
      where,
      skip,
      take,
    });
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
}

