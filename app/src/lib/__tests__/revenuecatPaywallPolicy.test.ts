import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  listPaywallPackagesOrdered,
  periodLabelKeyForPackage,
  pickPrimaryPaywallPackage,
  preferredPackageOrderFromEnv,
  type PaywallPackageLike,
} from '../revenuecatPaywallPolicy.ts';

const monthly: PaywallPackageLike = {
  identifier: '$rc_monthly',
  kind: 'MONTHLY',
  priceString: '$4.99',
};
const annual: PaywallPackageLike = {
  identifier: '$rc_annual',
  kind: 'ANNUAL',
  priceString: '$39.99',
};
const custom: PaywallPackageLike = {
  identifier: 'custom',
  kind: 'OTHER',
  priceString: '$9.99',
};

describe('revenuecatPaywallPolicy', () => {
  it('preferredPackageOrderFromEnv maps annual aliases', () => {
    assert.equal(preferredPackageOrderFromEnv('annual'), 'annual_first');
    assert.equal(preferredPackageOrderFromEnv('monthly'), 'monthly_first');
  });

  it('pickPrimaryPaywallPackage prefers monthly by default', () => {
    assert.equal(pickPrimaryPaywallPackage([annual, monthly, custom])?.identifier, '$rc_monthly');
  });

  it('listPaywallPackagesOrdered puts preferred first then the other period', () => {
    const ordered = listPaywallPackagesOrdered([custom, annual, monthly], 'monthly_first');
    assert.deepEqual(
      ordered.map((p) => p.identifier),
      ['$rc_monthly', '$rc_annual', 'custom'],
    );
  });

  it('periodLabelKeyForPackage maps kinds', () => {
    assert.equal(periodLabelKeyForPackage(monthly), 'month');
    assert.equal(periodLabelKeyForPackage(annual), 'year');
    assert.equal(periodLabelKeyForPackage(custom), 'other');
  });
});
