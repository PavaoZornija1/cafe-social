import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';

class AdminCreatePerkDto {
  code!: string;
  title!: string;
  subtitle?: string;
  body?: string;
  requiresQrUnlock?: boolean;
  activeFrom?: string | null;
  activeTo?: string | null;
  maxRedemptions?: number | null;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
export class AdminPerkController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('venues/:venueId/perks')
  list(@Param('venueId', new ParseUUIDPipe()) venueId: string) {
    return this.prisma.venuePerk.findMany({
      where: { venueId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('venues/:venueId/perks')
  create(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: AdminCreatePerkDto,
  ) {
    const code = dto.code.trim().toUpperCase().replace(/\s+/g, '');
    return this.prisma.venuePerk.create({
      data: {
        venueId,
        code,
        title: dto.title.trim(),
        subtitle: dto.subtitle?.trim() || null,
        body: dto.body?.trim() || null,
        requiresQrUnlock: dto.requiresQrUnlock ?? false,
        activeFrom: dto.activeFrom ? new Date(dto.activeFrom) : null,
        activeTo: dto.activeTo ? new Date(dto.activeTo) : null,
        maxRedemptions: dto.maxRedemptions ?? null,
      },
    });
  }

  @Delete('perks/:id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.prisma.venuePerk.delete({ where: { id } });
  }
}
