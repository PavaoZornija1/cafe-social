import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { WordCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';

class AdminCreateWordDto {
  text!: string;
  language?: string;
  category!: WordCategory;
  sentenceHint!: string;
  wordHints!: string[];
  emojiHints!: string[];
}

@Controller('admin/words')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
export class AdminWordController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query('language') language?: string, @Query('take') takeRaw?: string) {
    const take = Math.min(Number.parseInt(takeRaw ?? '100', 10) || 100, 500);
    return this.prisma.word.findMany({
      where: language ? { language } : undefined,
      orderBy: [{ language: 'asc' }, { text: 'asc' }],
      take,
    });
  }

  @Post()
  create(@Body() dto: AdminCreateWordDto) {
    return this.prisma.word.create({
      data: {
        text: dto.text.trim(),
        language: dto.language ?? 'en',
        category: dto.category,
        sentenceHint: dto.sentenceHint,
        wordHints: dto.wordHints ?? [],
        emojiHints: dto.emojiHints ?? [],
      },
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.word.delete({ where: { id } });
  }
}
