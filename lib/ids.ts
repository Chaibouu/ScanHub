import { randomBytes } from 'crypto';

/**
 * Identifiant au format des cuid générés par Prisma (25 caractères, commence par « c »),
 * pour les lignes insérées en SQL brut : horodatage en base 36 puis 16 caractères aléatoires.
 */
export function newId(): string {
  const time = Date.now().toString(36).padStart(8, '0');
  const random = Array.from(randomBytes(16), (byte) => (byte % 36).toString(36)).join('');
  return `c${time}${random}`;
}
