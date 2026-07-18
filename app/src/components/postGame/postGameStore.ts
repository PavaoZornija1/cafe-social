import type { PostGameCarouselActions, PostGamePayload } from '../../lib/postGame/types';

type Listener = () => void;
export type PostGameDismissReason = 'dismiss' | 'complete';
type DismissListener = (reason: PostGameDismissReason) => void;

type PostGameStoreState = {
  visible: boolean;
  payload: PostGamePayload | null;
  actions: PostGameCarouselActions | null;
};

let state: PostGameStoreState = {
  visible: false,
  payload: null,
  actions: null,
};

const listeners = new Set<Listener>();
const dismissListeners = new Set<DismissListener>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function emitDismiss(reason: PostGameDismissReason) {
  for (const listener of dismissListeners) {
    listener(reason);
  }
}

export function subscribePostGameCarousel(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribePostGameDismiss(listener: DismissListener): () => void {
  dismissListeners.add(listener);
  return () => dismissListeners.delete(listener);
}

export function getPostGameCarouselState(): PostGameStoreState {
  return state;
}

export function showPostGameCarousel(
  payload: PostGamePayload,
  actions: PostGameCarouselActions,
): void {
  state = { visible: true, payload, actions };
  emit();
}

/** Hide carousel without completing (user can return to match-end UI). */
export function hidePostGameCarousel(): void {
  if (!state.visible) return;
  state = { visible: false, payload: null, actions: null };
  emit();
  emitDismiss('dismiss');
}

/** Finish carousel: hide, refresh progress queries, then run screen onDone (navigate). */
export function completePostGameCarousel(): void {
  const actions = state.actions;
  if (!state.visible) return;
  state = { visible: false, payload: null, actions: null };
  emit();
  emitDismiss('complete');
  actions?.onDone();
}
