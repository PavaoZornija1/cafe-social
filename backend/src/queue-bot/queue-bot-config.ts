/** Env-driven tuning for queue bot-fill and word-match bot pacing. */

function intEnv(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function floatEnv(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

export type QueueBotConfig = {
  wordFillAfterMs: number;
  brawlerFillAfterMs: number;
  wordBotTickMs: number;
  correctRate: { easy: number; normal: number; hard: number };
  meanThinkMs: { easy: number; normal: number; hard: number };
  jitterPct: number;
};

export function getQueueBotConfig(): QueueBotConfig {
  return {
    wordFillAfterMs: intEnv('WORD_QUEUE_BOT_FILL_AFTER_MS', 10_000),
    brawlerFillAfterMs: intEnv('BRAWLER_QUEUE_BOT_FILL_AFTER_MS', 10_000),
    wordBotTickMs: intEnv('WORD_BOT_TICK_MS', 1000),
    correctRate: {
      easy: floatEnv('WORD_BOT_CORRECT_RATE_EASY', 0.95),
      normal: floatEnv('WORD_BOT_CORRECT_RATE_NORMAL', 0.85),
      hard: floatEnv('WORD_BOT_CORRECT_RATE_HARD', 0.7),
    },
    meanThinkMs: {
      easy: intEnv('WORD_BOT_MEAN_THINK_MS_EASY', 4500),
      normal: intEnv('WORD_BOT_MEAN_THINK_MS_NORMAL', 7000),
      hard: intEnv('WORD_BOT_MEAN_THINK_MS_HARD', 11_000),
    },
    jitterPct: 0.35,
  };
}

export function jitterAround(meanMs: number, jitterPct: number): number {
  const span = meanMs * jitterPct;
  const low = meanMs - span;
  const high = meanMs + span;
  return Math.round(low + Math.random() * (high - low));
}
