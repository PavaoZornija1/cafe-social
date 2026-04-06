import {
  Body,
  ConflictException,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';
import { AdminCmsGuard } from './admin-cms.guard';
import { CreateAdminVenueTypeDto } from './dto/create-admin-venue-type.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminCmsGuard)
export class AdminVenueTypeController {
  constructor(private readonly prisma: PrismaService) {}

  /** All venue category codes for CMS pickers (ordered by `code`). */
  @Get('venue-types')
  list() {
    return this.prisma.venueType.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, label: true },
    });
  }

  /** Super-admin: add a global venue category (M:N on venues). Nudge templates in DB can target types later. */
  @Post('venue-types')
  @UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
  async create(@Body() body: CreateAdminVenueTypeDto) {
    const code = body.code.trim().toUpperCase();
    const label = body.label?.trim() ? body.label.trim() : null;
    try {
      return await this.prisma.venueType.create({
        data: { code, label },
        select: { id: true, code: true, label: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Venue category code "${code}" already exists`);
      }
      throw e;
    }
  }
}
