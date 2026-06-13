type Listener = () => void;

const listeners = new Set<Listener>();

/** Notify Rewards hub (and similar) that quest-relevant activity occurred. */
export function emitPlatformQuestProgressChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribePlatformQuestProgressChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
