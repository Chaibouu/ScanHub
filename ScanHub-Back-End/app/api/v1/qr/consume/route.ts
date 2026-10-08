import { NextRequest } from 'next/server';
import { qrService } from '@/modules/qr/qrService';
import { deviceService } from '@/modules/devices/deviceService';
import { authorizeUser } from '@/lib/rbac';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { z } from 'zod';

const consumeSchema = z.object({
  token: z.string().trim().min(1, 'Token requis').max(512),
  eventId: z.string().optional(),
  clientId: z
    .string()
    .trim()
    .min(8, 'clientId UUID requis pour garantir l’idempotence')
    .max(100),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeUser(req);
    if (!auth.authorized) {
      return jsonError(auth.error, auth.status);
    }

    const deviceCheck = await deviceService.checkForScan(req, auth.user);
    if (!deviceCheck.ok) {
      return jsonError(deviceCheck.error, deviceCheck.status, { code: 'DEVICE_BLOCKED' });
    }

    const body = await req.json().catch(() => null);
    const parsed = consumeSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError('Requête de consommation invalide', 400, parsed.error.format());
    }

    // L'opérateur et le terminal viennent toujours de l'authentification, jamais du corps de la requête
    const result = await qrService.consume({
      token: parsed.data.token,
      eventId: parsed.data.eventId,
      clientId: parsed.data.clientId,
      userId: auth.user.id,
      deviceId: deviceCheck.device?.id,
    });

    return jsonSuccess(result);
  } catch (error) {
    return jsonServerError(error, 'Erreur interne lors de la consommation');
  }
}
