import { useEffect, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useSyncStore, syncStore } from '@/stores/syncStore';
import { offlineRepository } from '@/db/sqlite';
import { syncApi } from '@/api/syncApi';

// Taille de lot inférieure à la limite serveur (500 scans par requête)
const PUSH_BATCH_SIZE = 200;

export interface PushSummary {
  sent: number;
  accepted: number;
  conflicts: number;
  failed: number;
}

// Verrou partagé entre tous les écrans utilisant le hook
let pushInFlight: Promise<PushSummary> | null = null;

async function loadPendingFromDisk() {
  try {
    syncStore.getState().setPendingScans(await offlineRepository.getPendingScans());
  } catch {
    // SQLite indisponible : la file reste celle en mémoire
  }
}

async function pushPendingScans(): Promise<PushSummary> {
  const summary: PushSummary = { sent: 0, accepted: 0, conflicts: 0, failed: 0 };

  // SQLite fait foi : la file survit à un redémarrage de l'application
  await loadPendingFromDisk();
  const scansToPush = syncStore.getState().pendingScans;
  if (scansToPush.length === 0) return summary;

  syncStore.setState({ isSyncing: true });

  try {
    for (let i = 0; i < scansToPush.length; i += PUSH_BATCH_SIZE) {
      const batch = scansToPush.slice(i, i + PUSH_BATCH_SIZE);
      const response = await syncApi.pushScans(batch);

      const synced: string[] = [];
      const conflicts: string[] = [];
      for (const r of response.results) {
        if (r.status === 'ACCEPTED' || r.status === 'DUPLICATE') synced.push(r.clientId);
        // Conflit : le serveur a enregistré le scan avec son propre verdict, inutile de le renvoyer
        else if (r.status === 'CONFLICT') conflicts.push(r.clientId);
      }

      await offlineRepository.markScans(synced, 'SYNCED');
      await offlineRepository.markScans(conflicts, 'CONFLICT');

      summary.sent += batch.length;
      summary.accepted += synced.length;
      summary.conflicts += conflicts.length;
      summary.failed += batch.length - synced.length - conflicts.length;
    }

    syncStore.setState({ lastSyncedAt: new Date().toISOString() });
    return summary;
  } finally {
    await loadPendingFromDisk();
    syncStore.setState({ isSyncing: false });
  }
}

export function useSync() {
  const { isOnline, isSyncing, pendingScans, lastSyncedAt } = useSyncStore();

  /**
   * Push pending offline scans to central server.
   * Rejette si le serveur est injoignable (les scans restent en file).
   */
  const triggerPushSync = useCallback((): Promise<PushSummary> => {
    if (!pushInFlight) {
      pushInFlight = pushPendingScans().finally(() => {
        pushInFlight = null;
      });
    }
    return pushInFlight;
  }, []);

  /**
   * Pull event QR codes to cache them in SQLite for offline usage
   */
  const triggerPullSync = useCallback(async (eventId: string): Promise<number> => {
    syncStore.setState({ isSyncing: true });
    try {
      const response = await syncApi.pullQRCodes(eventId);
      await offlineRepository.saveBatchQRCodes(response.qrs ?? []);
      syncStore.setState({ lastSyncedAt: new Date().toISOString() });
      return response.qrs?.length ?? 0;
    } finally {
      syncStore.setState({ isSyncing: false });
    }
  }, []);

  /**
   * Monitor network connectivity automatically
   */
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      const wasOffline = !syncStore.getState().isOnline;

      syncStore.setState({ isOnline: connected });

      // Auto-push immediately when coming back online
      if (connected && wasOffline) {
        triggerPushSync().catch(() => {});
      }
    });

    // Au montage : recharge la file persistée puis tente un envoi
    triggerPushSync().catch(() => {});

    return unsubscribe;
  }, [triggerPushSync]);

  return {
    isOnline,
    isSyncing,
    pendingScans,
    lastSyncedAt,
    triggerPushSync,
    triggerPullSync,
  };
}
