import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { VenueService } from '../venue/venue.service';
import { CreateVenueDto } from '../venue/dto/create-venue.dto';
import { UpdateVenueDto } from '../venue/dto/update-venue.dto';

@Controller('admin/venues')
@UseGuards(AdminApiKeyGuard)
export class AdminVenueController {
  constructor(private readonly venues: VenueService) {}

  @Get()
  list() {
    return this.venues.findAll();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.venues.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateVenueDto) {
    return this.venues.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.venues.update(id, dto);
  }
}
