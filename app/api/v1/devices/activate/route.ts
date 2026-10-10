import { NextRequest } from 'next/server';
import { deviceService } from '@/modules/devices/deviceService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { rateLimitRedis } from '@/lib/rateLimitRedis';
import { getClientIP } from '@/lib/geo';
import { z } from 'zod';

const activateSchema = z.object({
  activationCode: z.string().min(6, 'Code requis').max(32),
  deviceName: z.string().trim().min(2).max(80).optional(),
});

// Endpoint public : limite stricte contre le brute-force des codes d'activation
const ACTIVATION_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 10 };

export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitRedis(`v1-activate:${getClientIP(req)}`, ACTIVATION_RATE_LIMIT);
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const parsed = activateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Code d’activation invalide', 400, parsed.error.format());
    }

    const activation = await deviceService.activate(
      parsed.data.activationCode,
      parsed.data.deviceName
    );

    if (!activation) {
      // Message volontairement unique : ne pas distinguer inconnu / expiré / déjà utilisé
      return jsonError('Code d’activation invalide ou expiré.', 404);
    }

    const { device, deviceKey } = activation;

    return jsonSuccess({
      activated: true,
      device: {
        ...deviceService.formatDevice(device),
        // Clé du terminal : transmise une seule fois, à conserver dans le stockage sécurisé de l'appareil
        deviceKey,
      },
      agent: {
        name: device.user.name || device.user.firstName || 'Agent',
      },
      message: 'Appareil activé avec succès.',
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de l’activation');
  }
}
