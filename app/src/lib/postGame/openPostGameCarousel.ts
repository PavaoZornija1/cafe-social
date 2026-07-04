import { showPostGameCarousel } from '../../components/postGame';
import { emitPlatformQuestProgressChanged } from '../platformQuestEvents';
import type { PostGamePayload } from './types';

export function presentPostGameCarousel(
  payload: PostGamePayload,
  actions: {
    onDone: () => void;
    onRematch?: () => void;
    rematchBusy?: boolean;
  },
): void {
  emitPlatformQuestProgressChanged();
  showPostGameCarousel(payload, actions);
}
