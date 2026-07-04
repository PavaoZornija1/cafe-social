import type { PostGameCarouselActions, PostGamePayload } from '../../lib/postGame/types';

type Listener = () => void;

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

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribePostGameCarousel(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
  state = { visible: false, payload: null, actions: null };
  emit();
}
