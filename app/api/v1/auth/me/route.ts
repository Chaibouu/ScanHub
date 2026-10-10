import { NextRequest } from 'next/server';
import { authService } from '@/modules/auth/authService';
import { deviceService } from '@/modules/devices/deviceService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    const user = await authService.authenticateRequest(req);
    if (!user) {
      return jsonError('Non autorisé', 401);
    }

    const { device } = await deviceService.findByRequest(req);

    return jsonSuccess({
      user: authService.publicUser(user),
      device: device ? deviceService.formatDevice(device) : null,
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la récupération du profil');
  }
}
