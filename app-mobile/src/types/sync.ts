import { QRType, QRStatus, ScanResultCode } from './qr';

export interface OfflineQRCode {
  id: string;
  tokenHash: string;
  type: QRType;
  status: QRStatus;
  reusable: boolean;
  eventId: string;
  holderName?: string;
  holderRole?: string;
  expiresAt?: string;
  metadataJson?: string;
  updatedAt: string;
}

export type SyncStatus = 'PENDING' | 'SYNCED' | 'CONFLICT' | 'FAILED';

export interface PendingScan {
  clientId: string; // UUID v4 for idempotence
  qrId?: string;
  token: string;
  eventId: string;
  userId: string;
  deviceId?: string;
  result: ScanResultCode;
  scannedAt: string;
  syncStatus: SyncStatus;
  offline: boolean;
  errorMessage?: string;
}

export interface SyncPushPayload {
  scans: {
    clientId: string;
    token: string;
    eventId?: string;
    result: ScanResultCode;
    scannedAt: string;
  }[];
}

export interface SyncPushResponse {
  total: number;
  accepted: number;
  conflicts: number;
  duplicates: number;
  failed: number;
  results: {
    clientId: string;
    status: 'ACCEPTED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED';
    /** Résultat retenu par le serveur après revalidation */
    result?: ScanResultCode;
    message?: string;
  }[];
}

export interface SyncPullResponse {
  eventId: string;
  syncedAt: string;
  qrs: OfflineQRCode[];
}
