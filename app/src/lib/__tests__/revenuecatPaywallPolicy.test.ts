import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  customerHasEntitlement,
  listPaywallPackagesOrdered,
  periodLabelKeyForPackage,
  pickPrimaryPaywallPackage,
  preferredPackageOrderFromEnv,
  type PaywallPackageLike,
} from '../revenuecatPaywallPolicy.ts';

const monthly: PaywallPackageLike = {
  identifier: 'monthly',
  kind: 'MONTHLY',
  priceString: '$4.99',
};
const annual: PaywallPackageLike = {
  identifier: 'yearly',
  kind: 'ANNUAL',
  priceString: '$39.99',
};
const lifetime: PaywallPackageLike = {
  identifier: 'lifetime',
  kind: 'LIFETIME',
  priceString: '$99.99',
};
const custom: PaywallPackageLike = {
  identifier: 'custom',
  kind: 'OTHER',
  priceString: '$9.99',
};

describe('revenuecatPaywallPolicy', () => {
  it('preferredPackageOrderFromEnv maps annual and lifetime', () => {
    assert.equal(preferredPackageOrderFromEnv('annual'), 'annual_first');
    assert.equal(preferredPackageOrderFromEnv('lifetime'), 'lifetime_first');
    assert.equal(preferredPackageOrderFromEnv('monthly'), 'monthly_first');
  });

  it('pickPrimaryPaywallPackage prefers monthly by default', () => {
    assert.equal(
      pickPrimaryPaywallPackage([lifetime, annual, monthly, custom])?.identifier,
      'monthly',
    );
  });

  it('listPaywallPackagesOrdered orders monthly yearly lifetime', () => {
    const ordered = listPaywallPackagesOrdered([custom, lifetime, annual, monthly], 'monthly_first');
    assert.deepEqual(
      ordered.map((p) => p.identifier),
      ['monthly', 'yearly', 'lifetime', 'custom'],
    );
  });

  it('periodLabelKeyForPackage maps kinds', () => {
    assert.equal(periodLabelKeyForPackage(monthly), 'month');
    assert.equal(periodLabelKeyForPackage(annual), 'year');
    assert.equal(periodLabelKeyForPackage(lifetime), 'lifetime');
    assert.equal(periodLabelKeyForPackage(custom), 'other');
  });

  it('customerHasEntitlement matches Cafe Social Pro', () => {
    assert.equal(customerHasEntitlement(['Cafe Social Pro'], 'Cafe Social Pro'), true);
    assert.equal(customerHasEntitlement(['premium'], 'Cafe Social Pro'), false);
  });
});
