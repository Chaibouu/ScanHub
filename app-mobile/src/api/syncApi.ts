import { apiClient } from './client';
import {
  PendingScan,
  SyncPushPayload,
  SyncPushResponse,
  SyncPullResponse,
} from '@/types/sync';

export const syncApi = {
  /**
   * Push a batch of offline pending scans to central server.
   * L'opérateur et le terminal sont déduits de l'authentification côté serveur.
   */
  async pushScans(pendingScans: PendingScan[]): Promise<SyncPushResponse> {
    const payload: SyncPushPayload = {
      scans: pendingScans.map((s) => ({
        clientId: s.clientId,
        token: s.token,
        ...(s.eventId ? { eventId: s.eventId } : {}),
        result: s.result,
        scannedAt: s.scannedAt,
      })),
    };

    return await apiClient<SyncPushResponse>('/sync/push', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Pull the QR codes of one event to populate the local SQLite cache
   */
  async pullQRCodes(eventId: string): Promise<SyncPullResponse> {
    return await apiClient<SyncPullResponse>(
      `/sync/pull?eventId=${encodeURIComponent(eventId)}`,
      { method: 'GET' }
    );
  },
};
