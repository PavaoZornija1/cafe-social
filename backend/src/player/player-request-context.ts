import { UnauthorizedException } from '@nestjs/common';
import type { Player } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

type Store = { players: Map<string, Promise<Player>>; deleted: Set<string>; active: boolean };

/** Only HTTP request stores retain rows; singleton services keep their existing scope. */
class PlayerRequestContext {
  private readonly storage = new AsyncLocalStorage<Store>();
  private readonly activeStores = new Set<Store>();

  readonly middleware = (_req: Request, res: Response, next: NextFunction) => {
    const store: Store = { players: new Map(), deleted: new Set(), active: true };
    this.activeStores.add(store);
    const close = () => {
      store.active = false;
      store.players.clear();
      this.activeStores.delete(store);
    };
    res.once('finish', close);
    res.once('close', close);
    this.storage.run(store, next);
  };

  async resolve(email: string, load: () => Promise<Player>): Promise<Player> {
    const store = this.storage.getStore();
    if (!store?.active) return load();
    if (store.deleted.has(email)) throw new UnauthorizedException('Account deleted');
    let promise = store.players.get(email);
    if (!promise) {
      promise = load();
      store.players.set(email, promise);
      // Failed lookups are retryable and must not poison the rest of the request.
      void promise.catch(() => {
        if (store.players.get(email) === promise) store.players.delete(email);
      });
    }
    const player = await promise;
    // A deletion may have happened while the original resolution was pending.
    if (store.deleted.has(email)) throw new UnauthorizedException('Account deleted');
    return player;
  }

  invalidate(email: string): void {
    // Invalidate overlapping in-process requests too, before deletion starts.
    for (const store of this.activeStores) {
      store.players.delete(email);
      store.deleted.add(email);
    }
  }
}

export const playerRequestContext = new PlayerRequestContext();
