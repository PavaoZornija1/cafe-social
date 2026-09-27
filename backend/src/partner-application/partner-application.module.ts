import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlayerModule } from '../player/player.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPartnerApplicationController } from './admin-partner-application.controller';
import { PartnerApplicationController } from './partner-application.controller';
import { PartnerApplicationService } from './partner-application.service';
import { PartnerApplicationThrottlerFilter } from './partner-application-throttle.filter';
import { PartnerProvisioningService } from './partner-provisioning.service';

@Module({
  imports: [PrismaModule, AuthModule, PlayerModule],
  controllers: [PartnerApplicationController, AdminPartnerApplicationController],
  providers: [
    PartnerApplicationService,
    PartnerProvisioningService,
    PartnerApplicationThrottlerFilter,
  ],
  exports: [PartnerApplicationService, PartnerProvisioningService],
})
export class PartnerApplicationModule {}
