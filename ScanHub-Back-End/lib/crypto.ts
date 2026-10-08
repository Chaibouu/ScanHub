import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const DEV_QR_PEPPER = 'scanhub_default_pepper';
const DEV_API_KEY_PEPPER = 'scanhub_api_default_pepper';

const warned = new Set<string>();

/**
 * Lit un secret d'environnement.
 * En production, l'absence du secret est bloquante. En développement, on retombe
 * sur une valeur locale connue (avec avertissement) pour ne pas casser le seed.
 */
function getSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Variable d'environnement ${name} manquante (obligatoire en production).`);
  }

  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`⚠️  ${name} non défini — valeur de développement utilisée. À définir avant tout déploiement.`);
  }
  return devFallback;
}

/**
 * Hash a plain QR token using SHA-256 with pepper
 */
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(`${token.trim()}${getSecret('QR_PEPPER', DEV_QR_PEPPER)}`)
    .digest('hex');
}

/**
 * Hash sans pepper d'un token QR, distribué aux terminaux pour la vérification
 * hors-ligne (le terminal recalcule SHA-256(token) localement, sans connaître le pepper).
 */
export function hashTokenOffline(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Hash an integration API Key (or device key / activation code) using SHA-256 with pepper
 */
export function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(`${apiKey.trim()}${getSecret('API_KEY_PEPPER', DEV_API_KEY_PEPPER)}`)
    .digest('hex');
}

/**
 * Hash d'un code d'activation de terminal (insensible à la casse, aux espaces et tirets)
 */
export function hashActivationCode(code: string): string {
  return hashApiKey(`activation:${code.replace(/[\s-]/g, '').toUpperCase()}`);
}

/**
 * Hash a user password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a user password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a cryptographically secure random QR token (128 bits), e.g. SCN_8F72K91X…
 */
export function generateToken(prefix = 'SCN'): string {
  const randomBytes = crypto.randomBytes(16).toString('hex').toUpperCase();
  return `${prefix}_${randomBytes}`;
}

/**
 * Generate a high-entropy secret (API key, device key), e.g. dvk_3fa9…
 */
export function generateSecret(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
}
