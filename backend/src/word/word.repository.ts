import { Injectable } from '@nestjs/common';
import type { Prisma, Word, WordCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
}

