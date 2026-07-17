import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shouldTriggerTabSwitchFeedback } from '../uiFeedbackPolicy.ts';

describe('shouldTriggerTabSwitchFeedback', () => {
  it('plays when switching to a different tab', () => {
    assert.equal(shouldTriggerTabSwitchFeedback(false, false), true);
  });

  it('stays silent when pressing the focused tab', () => {
    assert.equal(shouldTriggerTabSwitchFeedback(true, false), false);
  });

  it('stays silent when navigation is prevented', () => {
    assert.equal(shouldTriggerTabSwitchFeedback(false, true), false);
  });
});
