import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtValidationService } from './jwt-validation.service';
import { ClerkPartnerInviteService } from './clerk-partner-invite.service';
import { ClerkUserService } from './clerk-user.service';
import { BackgroundTokenService } from './background-token.service';
import { ClerkOrBackgroundAuthGuard } from './clerk-or-background-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    JwtValidationService,
    JwtAuthGuard,
    ClerkPartnerInviteService,
    ClerkUserService,
    BackgroundTokenService,
    ClerkOrBackgroundAuthGuard,
  ],
  exports: [
    JwtValidationService,
    JwtAuthGuard,
    ClerkPartnerInviteService,
    ClerkUserService,
    BackgroundTokenService,
    ClerkOrBackgroundAuthGuard,
  ],
})
export class AuthModule {}

