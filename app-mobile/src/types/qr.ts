export type QRType =
  | 'BADGE'
  | 'TICKET'
  | 'PASS'
  | 'COUPON'
  | 'DOCUMENT'
  | 'INVITATION'
  | 'CERTIFICATE'
  | 'PARTICIPANT'
  | 'AMBASSADOR';

export type QRStatus =
  | 'ACTIVE'
  | 'USED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'BLOCKED'
  | 'PENDING';

export type ScanResultCode =
  | 'VALID'
  | 'INVALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'ALREADY_USED'
  | 'EVENT_CLOSED'
  | 'UNAUTHORIZED'
  | 'DEVICE_BLOCKED';

export interface QRHolder {
  name: string;
  email?: string;
  role?: string;
  company?: string;
  avatarUrl?: string;
}

export interface QRItem {
  id: string;
  type: QRType;
  source: string;
  externalId?: string;
  reusable: boolean;
  expiresAt?: string;
  usedAt?: string;
}

export interface QRVerificationResult {
  valid: boolean;
  code: ScanResultCode;
  status: QRStatus;
  reusable: boolean;
  message?: string;
  qr?: QRItem;
  holder?: QRHolder;
  event?: {
    id: string;
    name: string;
  };
  metadata?: Record<string, unknown>;
  verifiedAt: string;
  offline?: boolean;
}

export interface QRVerifyRequest {
  token: string;
  source?: string;
  type?: QRType;
  eventId?: string;
}

export interface QRConsumeRequest {
  token: string;
  eventId?: string;
  clientId: string; // Idempotency key
}

export interface QRConsumeResult extends QRVerificationResult {
  consumed: boolean;
  consumedAt?: string;
}
