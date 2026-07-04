import type { PostGameCarouselActions, PostGamePayload } from '../../lib/postGame/types';

type Listener = () => void;
type DismissListener = () => void;

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

export function hidePostGameCarousel(): void {
  const wasVisible = state.visible;
  state = { visible: false, payload: null, actions: null };
  emit();
  if (wasVisible) {
    for (const listener of dismissListeners) {
      listener();
    }
  }
}
