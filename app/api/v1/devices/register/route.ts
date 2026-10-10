import { NextRequest } from 'next/server';
import { deviceService } from '@/modules/devices/deviceService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { authorizeUser } from '@/lib/rbac';
import { z } from 'zod';

const registerDeviceSchema = z.object({
  name: z.string().trim().min(2, 'Nom d’appareil requis').max(80),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeUser(req);
    if (!auth.authorized) {
      return jsonError(auth.error, auth.status);
    }

    const body = await req.json().catch(() => null);
    const parsed = registerDeviceSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Requête invalide', 400, parsed.error.format());
    }

    // La clé est toujours générée côté serveur — jamais fournie par le client
    const { device, deviceKey } = await deviceService.registerForUser(auth.user, parsed.data.name);

    return jsonSuccess(
      {
        ...deviceService.formatDevice(device),
        deviceKey,
        message: 'Appareil enregistré avec succès.',
      },
      201
    );
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de l’enregistrement');
  }
}
