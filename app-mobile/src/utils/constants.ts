import { ScanResultCode } from '@/types/qr';

export const API_CONFIG = {
  // Sur un téléphone, "localhost" désigne le téléphone lui-même : définir
  // EXPO_PUBLIC_API_URL (voir .env.example) avec l'adresse du serveur ScanHub.
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
  TIMEOUT_MS: 8000,
};

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'scanhub_access_token',
  REFRESH_TOKEN: 'scanhub_refresh_token',
  USER_DATA: 'scanhub_user_data',
  DEVICE_KEY: 'scanhub_device_key',
  DEVICE_DATA: 'scanhub_device_data',
  ACTIVE_EVENT: 'scanhub_active_event',
};

export const RESULT_THEMES: Record<
  ScanResultCode,
  {
    title: string;
    subtitle: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
    badgeBg: string;
    icon: string;
  }
> = {
  VALID: {
    title: 'Accès Autorisé',
    subtitle: 'Ce QR code est authentique et valide.',
    bgColor: '#ECFDF5',
    textColor: '#065F46',
    borderColor: '#10B981',
    badgeBg: '#D1FAE5',
    icon: 'check-circle',
  },
  INVALID: {
    title: 'QR Code Inconnu',
    subtitle: 'Ce code n’est pas reconnu dans le système ScanHub.',
    bgColor: '#FEF2F2',
    textColor: '#991B1B',
    borderColor: '#EF4444',
    badgeBg: '#FEE2E2',
    icon: 'x-circle',
  },
  ALREADY_USED: {
    title: 'Déjà Consommé',
    subtitle: 'Ce billet à usage unique a déjà été validé à l’entrée.',
    bgColor: '#FFFBEB',
    textColor: '#92400E',
    borderColor: '#F59E0B',
    badgeBg: '#FEF3C7',
    icon: 'alert-triangle',
  },
  EXPIRED: {
    title: 'Accès Expiré',
    subtitle: 'La période de validité de ce pass est dépassée.',
    bgColor: '#FFF7ED',
    textColor: '#9A3412',
    borderColor: '#F97316',
    badgeBg: '#FFEDD5',
    icon: 'clock',
  },
  REVOKED: {
    title: 'Pass Révoqué',
    subtitle: 'Ce pass a été annulé ou suspendu par l’organisateur.',
    bgColor: '#FEF2F2',
    textColor: '#991B1B',
    borderColor: '#DC2626',
    badgeBg: '#FEE2E2',
    icon: 'slash',
  },
  EVENT_CLOSED: {
    title: 'Événement Fermé',
    subtitle: 'Les contrôles ne sont pas encore ouverts ou sont terminés.',
    bgColor: '#F3F4F6',
    textColor: '#374151',
    borderColor: '#9CA3AF',
    badgeBg: '#E5E7EB',
    icon: 'lock',
  },
  UNAUTHORIZED: {
    title: 'Non Autorisé',
    subtitle: 'Vous n’avez pas les droits requis pour ce type d’accès.',
    bgColor: '#FDF2F8',
    textColor: '#9D174D',
    borderColor: '#EC4899',
    badgeBg: '#FCE7F3',
    icon: 'shield-alert',
  },
  DEVICE_BLOCKED: {
    title: 'Appareil Bloqué',
    subtitle: 'Ce terminal de scan a été désactivé par l’administrateur.',
    bgColor: '#F3F4F6',
    textColor: '#1F2937',
    borderColor: '#4B5563',
    badgeBg: '#E5E7EB',
    icon: 'smartphone-slash',
  },
};
