export const QUEUE_BOT_WAITING_EVENT = 'queue-bot.waiting';

export type QueueBotWaitingEvent = {
  game: 'word' | 'brawler';
  id: string;
  createdAt: Date;
};
