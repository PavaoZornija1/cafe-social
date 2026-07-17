import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveLocalFinalizeWinner, shouldHoldTwoHumanPvp } from '../brawlerPvpHold.ts';

describe('shouldHoldTwoHumanPvp', () => {
  it('never holds — authoritative combat is live for 2-human play', () => {
    assert.equal(shouldHoldTwoHumanPvp([{ isBot: false }, { isBot: true }]), false);
    assert.equal(shouldHoldTwoHumanPvp([{ isBot: false }, { isBot: false }]), false);
    assert.equal(shouldHoldTwoHumanPvp([{ isBot: false }]), false);
  });
});

describe('resolveLocalFinalizeWinner', () => {
  it('picks local when alive', () => {
    assert.equal(
      resolveLocalFinalizeWinner({
        localParticipantId: 'human-1',
        localAlive: true,
        botParticipantId: 'bot-1',
      }),
      'human-1',
    );
  });

  it('picks bot when local is dead', () => {
    assert.equal(
      resolveLocalFinalizeWinner({
        localParticipantId: 'human-1',
        localAlive: false,
        botParticipantId: 'bot-1',
      }),
      'bot-1',
    );
  });

  it('falls back to local id when dead and no bot', () => {
    assert.equal(
      resolveLocalFinalizeWinner({
        localParticipantId: 'human-1',
        localAlive: false,
        botParticipantId: undefined,
      }),
      'human-1',
    );
  });
});
