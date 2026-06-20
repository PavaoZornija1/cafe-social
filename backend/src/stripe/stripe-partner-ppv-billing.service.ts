import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

export const PARTNER_BILLING_MODEL_SUBSCRIPTION = 'SUBSCRIPTION' as const;
export const PARTNER_BILLING_MODEL_PAY_PER_VISIT = 'PAY_PER_VISIT' as const;

@Injectable()
export class StripePartnerPpvBillingService {
  private readonly log = new Logger(StripePartnerPpvBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private stripe(): Stripe {
    const key = this.config.get<string>('STRIPE_SECRET_KEY')?.trim();
    if (!key) {
      throw new BadRequestException('STRIPE_SECRET_KEY is not configured');
    }
    return new Stripe(key);
  }

  private portalOrigin(): string {
    const origin = this.config
      .get<string>('ADMIN_PORTAL_ORIGIN')
      ?.trim()
      .replace(/\/$/, '');
    if (!origin) {
      throw new BadRequestException(
        'ADMIN_PORTAL_ORIGIN is required for Stripe return URLs',
      );
    }
    return origin;
  }

  ppvMeteredPriceId(): string | null {
    return this.config.get<string>('STRIPE_PPV_METERED_PRICE_ID')?.trim() || null;
  }

  /**
   * Hosted Checkout for pay-per-visit: metered price subscription ($0 base + usage).
   */
  async createPartnerPpvCheckoutSession(organizationId: string): Promise<{ url: string }> {
    const priceId = this.ppvMeteredPriceId();
    if (!priceId) {
      throw new BadRequestException(
        'Set STRIPE_PPV_METERED_PRICE_ID on the server for pay-per-visit billing',
      );
    }

    const org = await this.prisma.venueOrganization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const origin = this.portalOrigin();
    const stripe = this.stripe();

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      success_url: `${origin}/owner/subscriptions?billing=success&model=ppv`,
      cancel_url: `${origin}/owner/subscriptions?billing=cancel`,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: organizationId,
      metadata: {
        organizationId,
        billingModel: PARTNER_BILLING_MODEL_PAY_PER_VISIT,
      },
      subscription_data: {
        metadata: {
          organizationId,
          billingModel: PARTNER_BILLING_MODEL_PAY_PER_VISIT,
        },
      },
    };
    if (org.stripeCustomerId) {
      params.customer = org.stripeCustomerId;
    }

    const session = await stripe.checkout.sessions.create(params);
    if (!session.url) {
      throw new Error('Stripe Checkout returned no redirect URL');
    }
    return { url: session.url };
  }

  /**
   * Persist metered subscription item id when webhook applies a PPV subscription.
   */
  async syncPpvSubscriptionItem(
    organizationId: string,
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const ppvPriceId = this.ppvMeteredPriceId();
    if (!ppvPriceId) return;

    const ppvItem = subscription.items.data.find(
      (item) => item.price?.id === ppvPriceId,
    );
    if (!ppvItem) return;

    await this.prisma.venueOrganization.update({
      where: { id: organizationId },
      data: {
        platformBillingModel: PARTNER_BILLING_MODEL_PAY_PER_VISIT,
        platformBillingPlan: 'Pay per visit',
        stripePpvSubscriptionItemId: ppvItem.id,
        stripeSubscriptionId: subscription.id,
      },
    });
  }

  /**
   * Report one billable visit to Stripe (idempotent per polygon session).
   */
  async reportBillableVisit(sessionId: string): Promise<void> {
    const enabled =
      this.config.get<string>('STRIPE_PPV_USAGE_REPORTING_ENABLED')?.trim() !== '0';
    if (!enabled) return;

    const session = await this.prisma.playerVenuePolygonSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        billableAt: true,
        stripeUsageReportedAt: true,
        venueId: true,
        venue: {
          select: {
            organizationId: true,
            organization: {
              select: {
                id: true,
                platformBillingModel: true,
                stripePpvSubscriptionItemId: true,
                platformBillingStatus: true,
              },
            },
          },
        },
      },
    });

    if (!session?.billableAt || session.stripeUsageReportedAt) return;

    const org = session.venue.organization;
    if (!org) return;
    if (org.platformBillingModel !== PARTNER_BILLING_MODEL_PAY_PER_VISIT) return;

    const itemId = org.stripePpvSubscriptionItemId?.trim();
    if (!itemId) {
      this.log.warn(
        JSON.stringify({
          msg: 'ppv_usage_skip_no_subscription_item',
          organizationId: org.id,
          sessionId,
        }),
      );
      return;
    }

    const billingSt = org.platformBillingStatus.trim().toUpperCase();
    if (billingSt !== 'ACTIVE' && billingSt !== 'TRIALING' && billingSt !== 'PAST_DUE') {
      this.log.warn(
        JSON.stringify({
          msg: 'ppv_usage_skip_inactive_billing',
          organizationId: org.id,
          sessionId,
          platformBillingStatus: billingSt,
        }),
      );
      return;
    }

    const stripe = this.stripe();
    const timestamp = Math.floor(session.billableAt.getTime() / 1000);

    try {
      await stripe.subscriptionItems.createUsageRecord(itemId, {
        quantity: 1,
        timestamp,
        action: 'increment',
      });

      await this.prisma.playerVenuePolygonSession.update({
        where: { id: sessionId },
        data: { stripeUsageReportedAt: new Date() },
      });

      this.log.log(
        JSON.stringify({
          msg: 'ppv_usage_reported',
          organizationId: org.id,
          sessionId,
          venueId: session.venueId,
          subscriptionItemId: itemId,
        }),
      );
    } catch (e) {
      this.log.warn(
        JSON.stringify({
          msg: 'ppv_usage_report_failed',
          organizationId: org.id,
          sessionId,
          error: (e as Error).message,
        }),
      );
    }
  }
}
