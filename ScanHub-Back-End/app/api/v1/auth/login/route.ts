import { NextRequest } from 'next/server';
import { authService, AuthError } from '@/modules/auth/authService';
import { deviceService } from '@/modules/devices/deviceService';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { rateLimitRedis } from '@/lib/rateLimitRedis';
import { getClientIP } from '@/lib/geo';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Plusieurs agents peuvent partager la même IP (Wi-Fi du site) : limite plus large que le web,
// le backoff par compte protège contre le brute-force ciblé.
const LOGIN_RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 30 };

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req);
    const limited = await rateLimitRedis(`v1-login:${ip}`, LOGIN_RATE_LIMIT);
    if (limited) return limited;

    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError('Données de connexion invalides', 400, parsed.error.format());
    }

    const result = await authService.login(parsed.data.email, parsed.data.password, {
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
    });

    if (result.requires2FA) {
      return jsonSuccess(result);
    }

    const { device } = await deviceService.findByRequest(req);

    return jsonSuccess({
      user: result.user,
      tokens: result.tokens,
      device: device ? deviceService.formatDevice(device) : null,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return jsonError(error.message, error.status);
    }
    return jsonServerError(error, 'Erreur lors de la connexion');
  }
}
