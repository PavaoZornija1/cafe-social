import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { VenueService } from './venue.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

@Controller('venues')
export class VenueController {
  constructor(private readonly venueService: VenueService) {}

  @Post()
  create(@Body() dto: CreateVenueDto) {
    return this.venueService.create(dto);
  }

  @Get()
  findAll() {
    return this.venueService.findAll();
  }

  @Get(':id/leaderboard/xp')
  venueXpLeaderboard(@Param('id') id: string) {
    return this.venueService.venueXpLeaderboard(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.venueService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.venueService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.venueService.remove(id);
  }
}

