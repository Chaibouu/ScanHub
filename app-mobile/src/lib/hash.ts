import * as Crypto from 'expo-crypto';

/**
 * Empreinte d'un token QR pour le cache hors-ligne : SHA-256(token) en hexadécimal.
 * Doit rester identique à `hashTokenOffline` côté serveur (lib/crypto.ts), qui
 * fournit cette même valeur dans /sync/pull.
 */
export async function hashTokenOffline(token: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, token.trim());
}
