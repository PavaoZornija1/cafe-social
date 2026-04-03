import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Stripe Billing for franchise / partner organizations (B2B SaaS).
 * Player subscriptions remain on RevenueCat — see RevenueCatModule.
 */
@Injectable()
export class StripePartnerBillingService {
  private readonly log = new Logger(StripePartnerBillingService.name);

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

  verifyWebhookEvent(
    rawBody: Buffer,
    signature: string | string[] | undefined,
  ): Stripe.Event {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim();
    if (!secret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not configured');
    }
    if (!signature || typeof signature !== 'string') {
      throw new BadRequestException('Missing stripe-signature header');
    }
    return this.stripe().webhooks.constructEvent(rawBody, signature, secret);
  }

  private subscriptionToOrgData(sub: Stripe.Subscription): {
    platformBillingStatus: string;
    platformBillingRenewsAt: Date | null;
    stripeSubscriptionId: string;
    platformBillingPlan: string | null;
  } {
    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      trialing: 'TRIALING',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      unpaid: 'UNPAID',
      incomplete: 'INCOMPLETE',
      incomplete_expired: 'INCOMPLETE_EXPIRED',
      paused: 'PAUSED',
    };
    const platformBillingStatus =
      statusMap[sub.status] ?? sub.status.toUpperCase();
    const platformBillingRenewsAt = sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null;
    const item = sub.items.data[0];
    const platformBillingPlan =
      item?.price?.nickname ??
      item?.price?.lookup_key ??
      item?.price?.id ??
      null;

    return {
      platformBillingStatus,
      platformBillingRenewsAt,
      stripeSubscriptionId: sub.id,
      platformBillingPlan,
    };
  }

  private customerIdFromStripe(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
  ): string | null {
    if (!customer) return null;
    return typeof customer === 'string' ? customer : customer.id;
  }

  async applySubscriptionEvent(sub: Stripe.Subscription): Promise<void> {
    const customerId = this.customerIdFromStripe(sub.customer);
    let org = customerId
      ? await this.prisma.venueOrganization.findFirst({
          where: { stripeCustomerId: customerId },
          select: { id: true, stripeCustomerId: true },
        })
      : null;

    const metaOrgId = sub.metadata?.organizationId?.trim();
    if (!org && metaOrgId) {
      org = await this.prisma.venueOrganization.findUnique({
        where: { id: metaOrgId },
        select: { id: true, stripeCustomerId: true },
      });
    }

    if (!org) {
      this.log.warn(
        `Stripe subscription ${sub.id}: no VenueOrganization for customer ${customerId ?? '—'} metadata org ${metaOrgId ?? '—'}`,
      );
      return;
    }

    const data = this.subscriptionToOrgData(sub);

    await this.prisma.venueOrganization.update({
      where: { id: org.id },
      data: {
        ...data,
        ...(customerId && !org.stripeCustomerId
          ? { stripeCustomerId: customerId }
          : {}),
      },
    });
  }

  async applySubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
    const customerId = this.customerIdFromStripe(sub.customer);
    const org = customerId
      ? await this.prisma.venueOrganization.findFirst({
          where: { stripeCustomerId: customerId },
        })
      : null;
    const metaOrgId = sub.metadata?.organizationId?.trim();
    const orgByMeta = metaOrgId
      ? await this.prisma.venueOrganization.findUnique({
          where: { id: metaOrgId },
        })
      : null;
    const target = org ?? orgByMeta;
    if (!target) return;

    await this.prisma.venueOrganization.update({
      where: { id: target.id },
      data: {
        platformBillingStatus: 'CANCELED',
        platformBillingRenewsAt: null,
        stripeSubscriptionId: null,
      },
    });
  }

  async applyCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    if (session.mode !== 'subscription') return;
    const orgId =
      session.metadata?.organizationId?.trim() ??
      session.client_reference_id?.trim();
    if (!orgId) return;
    const customerId = this.customerIdFromStripe(session.customer);
    if (!customerId) return;

    await this.prisma.venueOrganization.update({
      where: { id: orgId },
      data: { stripeCustomerId: customerId },
    });
  }

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.applyCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        return;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.applySubscriptionEvent(
          event.data.object as Stripe.Subscription,
        );
        return;
      case 'customer.subscription.deleted':
        await this.applySubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        return;
      default:
        /* ignore */
        return;
    }
  }

  async createPartnerCheckoutSession(
    organizationId: string,
    priceIdOverride?: string,
  ): Promise<{ url: string }> {
    const org = await this.prisma.venueOrganization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const priceId =
      priceIdOverride?.trim() ||
      this.config.get<string>('STRIPE_PARTNER_PRICE_ID')?.trim();
    if (!priceId) {
      throw new BadRequestException(
        'Set STRIPE_PARTNER_PRICE_ID on the server or pass priceId in the request body',
      );
    }

    const origin = this.portalOrigin();
    const stripe = this.stripe();

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      success_url: `${origin}/organizations/${organizationId}?billing=success`,
      cancel_url: `${origin}/organizations/${organizationId}?billing=cancel`,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: organizationId,
      metadata: { organizationId },
      subscription_data: {
        metadata: { organizationId },
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

  async createPartnerBillingPortalSession(
    organizationId: string,
  ): Promise<{ url: string }> {
    const org = await this.prisma.venueOrganization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (!org.stripeCustomerId) {
      throw new BadRequestException(
        'No Stripe customer on file — create a subscription via Checkout first',
      );
    }

    const origin = this.portalOrigin();
    const stripe = this.stripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${origin}/organizations/${organizationId}`,
    });
    return { url: portal.url };
  }
}
