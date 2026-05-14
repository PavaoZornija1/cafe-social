import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerOrgAccessService } from '../owner/partner-org-access.service';
import { StripePartnerBillingService } from './stripe-partner-billing.service';

describe('StripePartnerBillingService', () => {
  let service: StripePartnerBillingService;
  let prisma: { venueOrganization: { findUnique: jest.Mock; update: jest.Mock } };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      venueOrganization: { findUnique: jest.fn(), update: jest.fn() },
    };
    config = { get: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StripePartnerBillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: PartnerOrgAccessService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(StripePartnerBillingService);
  });

  describe('createPartnerEmbeddedSubscriptionClientSecret', () => {
    it('throws when STRIPE_PUBLISHABLE_KEY is missing', async () => {
      config.get.mockImplementation((key: string) =>
        key === 'STRIPE_PUBLISHABLE_KEY' ? '' : undefined,
      );
      await expect(
        service.createPartnerEmbeddedSubscriptionClientSecret('org1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when organization missing', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_PUBLISHABLE_KEY') return 'pk_test_x';
        return undefined;
      });
      prisma.venueOrganization.findUnique.mockResolvedValue(null);
      await expect(
        service.createPartnerEmbeddedSubscriptionClientSecret('org1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([
      ['ACTIVE', 'sub_live', 'active'],
      ['TRIALING', 'sub_trial', 'trialing'],
      ['ACTIVE_CANCELING', 'sub_cancel', 'active'],
      ['active', 'sub_ci', 'active'],
    ] as const)(
      'returns null clientSecret when already paying (%s)',
      async (billingStatus, stripeSubId, expectedSubStatus) => {
        config.get.mockImplementation((key: string) => {
          if (key === 'STRIPE_PUBLISHABLE_KEY') return 'pk_test_x';
          return undefined;
        });
        prisma.venueOrganization.findUnique.mockResolvedValue({
          id: 'org1',
          name: 'Org',
          platformBillingStatus: billingStatus,
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: stripeSubId,
        });
        const out = await service.createPartnerEmbeddedSubscriptionClientSecret('org1');
        expect(out).toEqual({
          publishableKey: 'pk_test_x',
          clientSecret: null,
          subscriptionId: stripeSubId,
          subscriptionStatus: expectedSubStatus,
        });
      },
    );

    it('throws when price id missing for non-paying org', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'STRIPE_PUBLISHABLE_KEY') return 'pk_test_x';
        if (key === 'STRIPE_PARTNER_PRICE_ID') return '';
        return undefined;
      });
      prisma.venueOrganization.findUnique.mockResolvedValue({
        id: 'org1',
        name: 'Org',
        platformBillingStatus: 'INCOMPLETE',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: null,
      });
      await expect(
        service.createPartnerEmbeddedSubscriptionClientSecret('org1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('verifyWebhookEvent', () => {
    it('throws when STRIPE_WEBHOOK_SECRET is not configured', () => {
      config.get.mockReturnValue(undefined);
      expect(() =>
        service.verifyWebhookEvent(Buffer.from('{}'), 'sig'),
      ).toThrow(BadRequestException);
    });

    it('throws when stripe-signature is missing', () => {
      config.get.mockImplementation((key: string) =>
        key === 'STRIPE_WEBHOOK_SECRET' ? 'whsec_x' : undefined,
      );
      expect(() => service.verifyWebhookEvent(Buffer.from('{}'), undefined)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('createPartnerBillingPortalSession', () => {
    it('throws when organization is missing', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'ADMIN_PORTAL_ORIGIN') return 'https://portal.example.com';
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_x';
        return undefined;
      });
      prisma.venueOrganization.findUnique.mockResolvedValue(null);
      await expect(service.createPartnerBillingPortalSession('org1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws when org has no Stripe customer', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'ADMIN_PORTAL_ORIGIN') return 'https://portal.example.com';
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_x';
        return undefined;
      });
      prisma.venueOrganization.findUnique.mockResolvedValue({
        id: 'org1',
        stripeCustomerId: null,
      });
      await expect(service.createPartnerBillingPortalSession('org1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns portal URL from Stripe', async () => {
      const portalCreate = jest.fn().mockResolvedValue({ url: 'https://stripe.test/portal' });
      jest
        .spyOn(service as unknown as { stripe: () => object }, 'stripe')
        .mockReturnValue({
          billingPortal: { sessions: { create: portalCreate } },
        });
      config.get.mockImplementation((key: string) => {
        if (key === 'ADMIN_PORTAL_ORIGIN') return 'https://portal.example.com';
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_x';
        return undefined;
      });
      prisma.venueOrganization.findUnique.mockResolvedValue({
        id: 'org1',
        stripeCustomerId: 'cus_abc',
      });
      const out = await service.createPartnerBillingPortalSession('org1', 'partner-subscriptions');
      expect(out).toEqual({ url: 'https://stripe.test/portal' });
      expect(portalCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_abc',
          return_url: 'https://portal.example.com/owner/subscriptions',
        }),
      );
      jest.restoreAllMocks();
    });
  });
});
