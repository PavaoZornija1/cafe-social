import { getQueueBotConfig, jitterAround } from './queue-bot-config';

describe('queue-bot-config', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('jitterAround stays within jitter band', () => {
    const mean = 7000;
    const jitterPct = 0.35;
    for (let i = 0; i < 50; i++) {
      const j = jitterAround(mean, jitterPct);
      expect(j).toBeGreaterThanOrEqual(Math.round(mean * (1 - jitterPct)) - 1);
      expect(j).toBeLessThanOrEqual(Math.round(mean * (1 + jitterPct)) + 1);
    }
  });

  it('reads WORD_QUEUE_BOT_FILL_AFTER_MS', () => {
    process.env.WORD_QUEUE_BOT_FILL_AFTER_MS = '15000';
    expect(getQueueBotConfig().wordFillAfterMs).toBe(15000);
  });
});
