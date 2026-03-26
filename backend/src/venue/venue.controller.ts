import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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

  @Get('leaderboard/xp/global')
  globalXpLeaderboard(@Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 50;
    return this.venueService.globalXpLeaderboard(Number.isFinite(n) ? n : 50);
  }

  @Get('leaderboard/xp/country/:country')
  countryXpLeaderboard(
    @Param('country') country: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 50;
    return this.venueService.countryXpLeaderboard(
      country,
      Number.isFinite(n) ? n : 50,
    );
  }

  @Get('leaderboard/xp/city')
  cityXpLeaderboard(
    @Query('city') city?: string,
    @Query('country') country?: string,
    @Query('limit') limit?: string,
  ) {
    if (!city?.trim() || !country?.trim()) {
      throw new BadRequestException('city and country query params are required');
    }
    const n = limit ? Number(limit) : 50;
    return this.venueService.cityXpLeaderboard(
      city,
      country,
      Number.isFinite(n) ? n : 50,
    );
  }

  @Get(':id/leaderboard/xp')
  venueXpLeaderboard(@Param('id') id: string) {
    return this.venueService.venueXpLeaderboard(id);
  }

  /** No auth — safe public card for Home / deep links. */
  @Get(':id/public-card')
  publicCard(@Param('id') id: string) {
    return this.venueService.getPublicCard(id);
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

