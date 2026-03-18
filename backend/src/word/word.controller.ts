import { Controller, Get, Query } from '@nestjs/common';
import { WordService } from './word.service';
import type { WordCategory } from '@prisma/client';

type WordSessionQuery = {
  language?: string;
  category?: WordCategory;
  count?: string;
};

@Controller('words')
export class WordController {
  constructor(private readonly words: WordService) {}

  @Get('session')
  async getSessionDeck(@Query() query: WordSessionQuery) {
    const language = query.language ?? 'en';
    const count = Number(query.count ?? '5');
    const category = query.category;

    return this.words.getWordSessionDeck({
      language,
      category,
      count,
    });
  }
}

