import * as Crypto from 'expo-crypto';

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function formatTime(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function truncateToken(token: string, maxLen = 16): string {
  if (!token) return '';
  if (token.length <= maxLen) return token;
  const half = Math.floor((maxLen - 3) / 2);
  return `${token.slice(0, half)}...${token.slice(-half)}`;
}

/** UUID v4 cryptographiquement aléatoire (clé d'idempotence des scans) */
export function generateUUID(): string {
  return Crypto.randomUUID();
}
