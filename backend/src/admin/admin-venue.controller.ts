import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperAdminGuard } from '../auth/platform-super-admin.guard';
import { VenueService } from '../venue/venue.service';
import { CreateVenueDto } from '../venue/dto/create-venue.dto';
import { AdminPatchVenueDto } from '../venue/dto/admin-patch-venue.dto';

@Controller('admin/venues')
@UseGuards(JwtAuthGuard, PlatformSuperAdminGuard)
export class AdminVenueController {
  constructor(private readonly venues: VenueService) {}

  @Get()
  async list() {
    const rows = await this.venues.findAll();
    return rows.map((v) => this.venues.sanitizeVenueForAdmin(v));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const v = await this.venues.findOne(id);
    return this.venues.sanitizeVenueForAdmin(v);
  }

  @Post()
  create(@Body() dto: CreateVenueDto) {
    return this.venues.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AdminPatchVenueDto) {
    return this.venues.updateForAdmin(id, dto);
  }
}
