import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtValidationService } from './jwt-validation.service';

@Module({
  providers: [JwtValidationService, JwtAuthGuard],
  exports: [JwtValidationService, JwtAuthGuard],
})
export class AuthModule {}

