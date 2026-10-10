import { NextRequest } from 'next/server';
import { qrService } from '@/modules/qr/qrService';
import { deviceService } from '@/modules/devices/deviceService';
import { authorizeUser } from '@/lib/rbac';
import { toViewer } from '@/lib/tenant';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { z } from 'zod';

const verifySchema = z.object({
  token: z.string().trim().min(1, 'Token requis').max(512),
  eventId: z.string().optional(),
  source: z.string().optional(),
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
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return jsonError('Requête de vérification invalide', 400, parsed.error.format());
    }

    const result = await qrService.verify({
      ...parsed.data,
      organizationId: toViewer(auth.user).organizationId,
    });
    return jsonSuccess(result);
  } catch (error) {
    return jsonServerError(error, 'Erreur interne lors de la vérification');
  }
}
