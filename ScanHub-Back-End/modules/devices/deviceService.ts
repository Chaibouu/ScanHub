import crypto from 'crypto';
import type { Device, User } from '@prisma/client';
import prisma from '@/lib/prisma';
import { generateSecret, hashActivationCode, hashApiKey } from '@/lib/crypto';

const ACTIVATION_CODE_TTL_MS = 48 * 60 * 60 * 1000; // 48h
const ACTIVATION_CODE_LENGTH = 8;
// Alphabet sans caractères ambigus (0/O, 1/I/L)
const ACTIVATION_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LAST_SEEN_THROTTLE_MS = 60 * 1000;

export const DEVICE_KEY_HEADER = 'x-device-key';

export function generateActivationCode(): string {
  let code = '';
  for (let i = 0; i < ACTIVATION_CODE_LENGTH; i++) {
    code += ACTIVATION_ALPHABET[crypto.randomInt(ACTIVATION_ALPHABET.length)];
  }
  return code;
}

function formatDevice(device: Device) {
  return {
    id: device.id,
    name: device.name,
    active: device.active,
    registeredAt: device.createdAt.toISOString(),
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
  };
}

export type DeviceCheck =
  | { ok: true; device: Device | null }
  | { ok: false; status: 403; error: string };

export const deviceService = {
  formatDevice,

  /**
   * Crée un terminal en attente d'activation. Le code en clair n'est retourné
   * qu'ici, une seule fois — seul son hash est stocké.
   */
  async createPendingDevice(name: string, userId: string) {
    const activationCode = generateActivationCode();
    const activationExpiresAt = new Date(Date.now() + ACTIVATION_CODE_TTL_MS);

    const device = await prisma.device.create({
      data: {
        name,
        userId,
        active: true,
        activationCodeHash: hashActivationCode(activationCode),
        activationExpiresAt,
      },
    });

    return { device, activationCode, activationExpiresAt };
  },

  /** Régénère un code d'activation (terminal perdu / réinstallé) et invalide l'ancienne clé. */
  async resetActivation(deviceId: string) {
    const activationCode = generateActivationCode();
    const activationExpiresAt = new Date(Date.now() + ACTIVATION_CODE_TTL_MS);

    const device = await prisma.device.update({
      where: { id: deviceId },
      data: {
        deviceKeyHash: null,
        activatedAt: null,
        activationCodeHash: hashActivationCode(activationCode),
        activationExpiresAt,
      },
    });

    return { device, activationCode, activationExpiresAt };
  },

  /**
   * Échange un code d'activation à usage unique contre la clé du terminal.
   * Retourne null si le code est inconnu, expiré, déjà utilisé ou le terminal bloqué.
   */
  async activate(code: string, deviceName?: string) {
    const activationCodeHash = hashActivationCode(code);
    const deviceKey = generateSecret('dvk');
    const now = new Date();

    // updateMany conditionnel : deux activations simultanées du même code ne peuvent pas réussir toutes les deux
    const { count } = await prisma.device.updateMany({
      where: {
        activationCodeHash,
        activatedAt: null,
        active: true,
        activationExpiresAt: { gt: now },
      },
      data: {
        deviceKeyHash: hashApiKey(deviceKey),
        activatedAt: now,
        lastSeenAt: now,
        activationCodeHash: null,
        activationExpiresAt: null,
        ...(deviceName ? { name: deviceName } : {}),
      },
    });

    if (count === 0) return null;

    const device = await prisma.device.findUnique({
      where: { deviceKeyHash: hashApiKey(deviceKey) },
      include: { user: true },
    });
    if (!device) return null;

    return { device, deviceKey };
  },

  /** Un agent authentifié enregistre directement son propre terminal. */
  async registerForUser(user: User, name: string) {
    const deviceKey = generateSecret('dvk');
    const now = new Date();

    const device = await prisma.device.create({
      data: {
        name,
        userId: user.id,
        active: true,
        deviceKeyHash: hashApiKey(deviceKey),
        activatedAt: now,
        lastSeenAt: now,
      },
    });

    return { device, deviceKey };
  },

  /** Résout le terminal à partir de l'en-tête x-device-key (null si absent ou inconnu). */
  async findByRequest(request: Request): Promise<{ provided: boolean; device: Device | null }> {
    const deviceKey = request.headers.get(DEVICE_KEY_HEADER)?.trim();
    if (!deviceKey) return { provided: false, device: null };

    const device = await prisma.device.findUnique({
      where: { deviceKeyHash: hashApiKey(deviceKey) },
    });
    if (!device || !device.activatedAt) return { provided: true, device: null };

    if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
      await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    }

    return { provided: true, device };
  },

  /**
   * Contrôle le terminal pour une opération de scan.
   * - Clé fournie : le terminal doit exister et être actif.
   * - Clé absente : refusé pour un AGENT (les agents scannent depuis un terminal activé),
   *   toléré pour les administrateurs.
   */
  async checkForScan(request: Request, user: User): Promise<DeviceCheck> {
    const { provided, device } = await this.findByRequest(request);

    if (provided) {
      if (!device) {
        return { ok: false, status: 403, error: 'Terminal inconnu ou non activé.' };
      }
      if (!device.active) {
        return { ok: false, status: 403, error: 'Ce terminal a été bloqué par un administrateur.' };
      }
      return { ok: true, device };
    }

    if (user.role === 'AGENT') {
      return {
        ok: false,
        status: 403,
        error: 'Terminal non activé : activez cet appareil avant de scanner.',
      };
    }

    return { ok: true, device: null };
  },
};
