import { BadRequestException, Injectable } from '@nestjs/common';
import type { Word, WordCategory } from '@prisma/client';
import { WordRepository } from './word.repository';

export type WordSessionDto = {
  words: Array<{
    id: string;
    text: string;
    language: string;
    category: WordCategory;
    sentenceHint: string;
    wordHints: string[];
    emojiHints: string[];
  }>;
};

@Injectable()
export class WordService {
  constructor(private readonly words: WordRepository) {}

  async getWordSessionDeck(params: {
    language: string;
    category?: WordCategory;
    count: number;
  }): Promise<WordSessionDto> {
    if (!params.language) throw new BadRequestException('language is required');
    if (params.count <= 0) throw new BadRequestException('count must be > 0');

    const rows: Word[] = await this.words.findRandomSessionDeck({
      language: params.language,
      category: params.category,
      count: params.count,
    });

    return {
      words: rows.map((w) => ({
        id: w.id,
        text: w.text,
        language: w.language,
        category: w.category,
        sentenceHint: w.sentenceHint,
        wordHints: w.wordHints,
        emojiHints: w.emojiHints,
      })),
    };
  }
}

