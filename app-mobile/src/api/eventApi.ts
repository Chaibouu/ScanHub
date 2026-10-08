import { apiClient } from './client';
import { EventItem } from '@/types/event';
import { ScanResultCode } from '@/types/qr';

export interface ScanHistoryItem {
  id: string;
  clientId: string | null;
  result: ScanResultCode;
  offline: boolean;
  scannedAt: string;
  holderName: string;
  role: string;
  qrType: string;
  source: string;
  event: string;
}

export const eventApi = {
  async list(): Promise<EventItem[]> {
    const res = await apiClient<{ events: EventItem[] }>('/events', { method: 'GET' });
    return res.events;
  },

  /** Derniers scans de l'agent connecté (le serveur filtre par opérateur) */
  async recentScans(eventId?: string, limit = 50): Promise<ScanHistoryItem[]> {
    const query = `?limit=${limit}${eventId ? `&eventId=${encodeURIComponent(eventId)}` : ''}`;
    const res = await apiClient<{ scans: ScanHistoryItem[] }>(`/scans${query}`, { method: 'GET' });
    return res.scans;
  },
};
