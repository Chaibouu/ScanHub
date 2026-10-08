import { EventItem } from '@/types/event';
import { eventApi } from '@/api/eventApi';
import { secureStorage } from '@/lib/secureStore';
import { STORAGE_KEYS } from '@/utils/constants';
import { SimpleStore, useStore } from './createStore';

interface EventState {
  activeEvent: EventItem | null;
  events: EventItem[];
  isLoading: boolean;
  error: string | null;
  /** Relit l'événement actif persisté (utile au démarrage hors-ligne) */
  hydrate: () => Promise<void>;
  loadEvents: () => Promise<void>;
  setActiveEvent: (event: EventItem | null) => Promise<void>;
  reset: () => Promise<void>;
}

export const eventStore = new SimpleStore<EventState>({
  activeEvent: null,
  events: [],
  isLoading: false,
  error: null,

  hydrate: async () => {
    try {
      const raw = await secureStorage.getItem(STORAGE_KEYS.ACTIVE_EVENT);
      if (raw && !eventStore.getState().activeEvent) {
        eventStore.setState({ activeEvent: JSON.parse(raw) as EventItem });
      }
    } catch {
      // Pas d'événement persisté
    }
  },

  loadEvents: async () => {
    eventStore.setState({ isLoading: true, error: null });
    try {
      const events = await eventApi.list();
      const current = eventStore.getState().activeEvent;
      // Rafraîchit les statistiques de l'événement actif, ou en choisit un par défaut
      const refreshed = current ? events.find((e) => e.id === current.id) : undefined;
      const fallback = events.find((e) => e.status === 'ACTIVE') ?? events[0] ?? null;

      eventStore.setState({ events, isLoading: false });
      await eventStore.getState().setActiveEvent(refreshed ?? current ?? fallback);
    } catch (err) {
      eventStore.setState({
        isLoading: false,
        error: (err as Error)?.message || 'Impossible de charger les événements.',
      });
    }
  },

  setActiveEvent: async (event) => {
    eventStore.setState({ activeEvent: event });
    try {
      if (event) {
        await secureStorage.setItem(STORAGE_KEYS.ACTIVE_EVENT, JSON.stringify(event));
      } else {
        await secureStorage.deleteItem(STORAGE_KEYS.ACTIVE_EVENT);
      }
    } catch {
      // La persistance est un confort : l'état en mémoire reste valide
    }
  },

  reset: async () => {
    eventStore.setState({ activeEvent: null, events: [], error: null });
    try {
      await secureStorage.deleteItem(STORAGE_KEYS.ACTIVE_EVENT);
    } catch {
      //
    }
  },
});

export function useEventStore() {
  return useStore(eventStore);
}
