import type { WordCategory } from '@prisma/client';

/** Hints safe to expose to clients (never includes `text`). */
export type WordPublicHint = {
  id: string;
  language: string;
  category: WordCategory;
  sentenceHint: string;
  wordHints: string[];
  emojiHints: string[];
};

export function wordToPublicHints(w: {
  id: string;
  language: string;
  category: WordCategory;
  sentenceHint: string;
  wordHints: string[];
  emojiHints: string[];
}): WordPublicHint {
  return {
    id: w.id,
    language: w.language,
    category: w.category,
    sentenceHint: w.sentenceHint,
    wordHints: w.wordHints,
    emojiHints: w.emojiHints,
  };
}
