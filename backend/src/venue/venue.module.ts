import { Module, forwardRef } from '@nestjs/common';
import { VenueController } from './venue.controller';
import { VenueService } from './venue.service';
import { VenueRepository } from './venue.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { VenueAccessController } from './venue-access.controller';
import { VenueAccessService } from './venue-access.service';
import { PlayerVenueRepository } from './player-venue.repository';
import { PlayerVenueCheckInRepository } from './player-venue-check-in.repository';
import { SubscriptionRepository } from './subscription.repository';
import { PlayerModule } from '../player/player.module';
import { AuthModule } from '../auth/auth.module';
import { VenueOfferService } from './venue-offer.service';
import { VenueOfferController } from './venue-offer.controller';
import { VenueOrderNudgeCopyService } from './venue-order-nudge-copy.service';
import { VenueNudgeAdminService } from './venue-nudge-admin.service';
import { VenuePlayLimitService } from './venue-play-limit.service';
import { VenuePlayBudgetService } from './venue-play-budget.service';
import { VenuePlayBudgetController } from './venue-play-budget.controller';
import { VenueFunnelService } from './venue-funnel.service';
import { VenueModerationService } from './venue-moderation.service';
import { VenuePlayerReportController } from './venue-player-report.controller';
import { PushModule } from '../push/push.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => PlayerModule),
    AuthModule,
    PushModule,
    NotificationModule,
  ],
  controllers: [
    VenueController,
    VenueAccessController,
    VenueOfferController,
    VenuePlayerReportController,
    VenuePlayBudgetController,
  ],
  providers: [
    VenueService,
    VenueOfferService,
    VenueOrderNudgeCopyService,
    VenueNudgeAdminService,
    VenueFunnelService,
    VenueModerationService,
    VenuePlayLimitService,
    VenuePlayBudgetService,
    VenueRepository,
    VenueAccessService,
    PlayerVenueRepository,
    PlayerVenueCheckInRepository,
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
    VenuePlayBudgetService,
    SubscriptionRepository,
    PlayerVenueRepository,
    PlayerVenueCheckInRepository,
  ],
})
export class VenueModule {}

