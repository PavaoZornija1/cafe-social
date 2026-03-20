import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { normalizeUserEmail } from '../auth/user-email.util';
import { PlayerService } from './player.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UpdateMeSettingsDto } from './dto/update-me-settings.dto';

@Controller('players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  private normalizeEmail(user: unknown): string | null {
    return normalizeUserEmail(user);
  }

  @Post()
  create(@Body() dto: CreatePlayerDto) {
    return this.playerService.create(dto);
  }

  @Get()
  findAll() {
    return this.playerService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/summary')
  meSummary(@CurrentUser() user: unknown) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.getMeSummary(email);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/settings')
  meSettings(@CurrentUser() user: unknown, @Body() dto: UpdateMeSettingsDto) {
    const email = this.normalizeEmail(user);
    if (!email) throw new UnauthorizedException('Missing user email');
    return this.playerService.updateMeSettings(email, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.playerService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePlayerDto) {
    return this.playerService.update(id, dto);
  }
}

