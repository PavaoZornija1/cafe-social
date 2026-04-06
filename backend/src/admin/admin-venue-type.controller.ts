import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminCmsGuard } from './admin-cms.guard';

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
}
