import type { User } from '@prisma/client';
import { authorizeUser } from '@/lib/rbac';
import { deviceService } from '@/modules/devices/deviceService';
import { jsonError } from '@/lib/response';

type ScanAuthResult =
  | { ok: true; user: User; deviceId: string | undefined }
  | { ok: false; response: Response };

/**
 * Authentifie un terminal de scan : session de l'agent + clé du terminal.
 *
 * Les deux recherches partent en parallèle : chaque aller-retour vers la base compte
 * quand un agent attend le verdict, billet à la main.
 */
export async function authorizeScanRequest(req: Request): Promise<ScanAuthResult> {
  const [auth, deviceLookup] = await Promise.all([
    authorizeUser(req),
    deviceService.findByRequest(req),
  ]);

  if (!auth.authorized) {
    return { ok: false, response: jsonError(auth.error, auth.status) };
  }

  const deviceCheck = deviceService.evaluateForScan(deviceLookup, auth.user);
  if (!deviceCheck.ok) {
    return {
      ok: false,
      response: jsonError(deviceCheck.error, deviceCheck.status, { code: 'DEVICE_BLOCKED' }),
    };
  }

  return { ok: true, user: auth.user, deviceId: deviceCheck.device?.id };
}
