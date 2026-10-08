import { useSyncExternalStore } from 'react';

type Listener = () => void;

/** Store minimal (getState / setState / subscribe), partagé par tous les stores de l'app. */
export class SimpleStore<T> {
  private state: T;
  private listeners: Set<Listener> = new Set();

  constructor(initialState: T) {
    this.state = initialState;
  }

  getState = () => this.state;

  setState = (partial: Partial<T> | ((state: T) => Partial<T>)) => {
    const next = typeof partial === 'function' ? partial(this.state) : partial;
    this.state = { ...this.state, ...next };
    this.listeners.forEach((l) => l());
  };

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}

export function useStore<T>(store: SimpleStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
