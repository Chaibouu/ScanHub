import { PendingScan } from '@/types/sync';
import { SimpleStore, useStore } from './createStore';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingScans: PendingScan[];
  lastSyncedAt: string | null;
  setOnline: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  addPendingScan: (scan: PendingScan) => void;
  setPendingScans: (scans: PendingScan[]) => void;
  setLastSyncedAt: (date: string) => void;
}

export const syncStore = new SimpleStore<SyncState>({
  isOnline: true,
  isSyncing: false,
  pendingScans: [],
  lastSyncedAt: null,
  setOnline: (isOnline) => syncStore.setState({ isOnline }),
  setSyncing: (isSyncing) => syncStore.setState({ isSyncing }),
  addPendingScan: (scan) =>
    syncStore.setState((prev) => ({
      pendingScans: [scan, ...prev.pendingScans.filter((s) => s.clientId !== scan.clientId)],
    })),
  setPendingScans: (scans) => syncStore.setState({ pendingScans: scans }),
  setLastSyncedAt: (date) => syncStore.setState({ lastSyncedAt: date }),
});

export function useSyncStore() {
  return useStore(syncStore);
}
