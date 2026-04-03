import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtValidationService } from './jwt-validation.service';
import { ClerkPartnerInviteService } from './clerk-partner-invite.service';

@Module({
  providers: [
    JwtValidationService,
    JwtAuthGuard,
    ClerkPartnerInviteService,
  ],
  exports: [
    JwtValidationService,
    JwtAuthGuard,
    ClerkPartnerInviteService,
  ],
})
export class AuthModule {}

