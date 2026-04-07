import { Module, forwardRef } from '@nestjs/common';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { VenueRepository } from './venue.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueAccessController } from './venue-access.controller';
import { VenueAccessService } from './venue-access.service';
import { PlayerVenueRepository } from './player-venue.repository';
import { SubscriptionRepository } from './subscription.repository';
import { PlayerModule } from '../player/player.module';
import { AuthModule } from '../auth/auth.module';
import { VenueOfferService } from './venue-offer.service';
import { VenueOfferController } from './venue-offer.controller';
import { VenueOrderNudgeCopyService } from './venue-order-nudge-copy.service';
import { VenueNudgeAdminService } from './venue-nudge-admin.service';
import { VenuePlayLimitService } from './venue-play-limit.service';
import { VenueFunnelService } from './venue-funnel.service';
import { VenueModerationService } from './venue-moderation.service';
import { VenuePlayerReportController } from './venue-player-report.controller';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => PlayerModule),
    AuthModule,
    PushModule,
  ],
  controllers: [VenueController, VenueAccessController, VenueOfferController, VenuePlayerReportController],
  providers: [
    VenueService,
    VenueOfferService,
    VenueOrderNudgeCopyService,
    VenueNudgeAdminService,
    VenueFunnelService,
    VenueModerationService,
    VenuePlayLimitService,
    VenueRepository,
    VenueAccessService,
    PlayerVenueRepository,
    SubscriptionRepository,
  ],
  exports: [
    VenueService,
    VenueOfferService,
    VenueOrderNudgeCopyService,
    VenueNudgeAdminService,
    VenueFunnelService,
    VenueModerationService,
    VenuePlayLimitService,
    SubscriptionRepository,
    PlayerVenueRepository,
  ],
})
export class VenueModule {}

