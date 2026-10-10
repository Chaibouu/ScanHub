import crypto from 'crypto';
import type { Session, User } from '@prisma/client';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/crypto';
import { createEncryptedJWT, getFullTokenPayload, hashRefreshToken } from '@/lib/tokens';
import {
  getBackoffDelay,
  getFailedAttempts,
  incrementFailedAttempt,
  resetFailedAttempts,
} from '@/lib/backoff';
import { audit } from '@/lib/audit';
import appConfig from '@/settings';

const ACCESS_TOKEN_TTL_SEC = 60 * 60; // 1h, cohérent avec le login web
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours pour les terminaux

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface AuthContext {
  user: User;
  session: Session;
  token: string;
}

interface LoginMeta {
  ipAddress?: string;
  userAgent?: string;
}

function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7).trim() || null;
  }

  // Repli : cookie de session du tableau de bord (ex: export CSV ouvert depuis le navigateur)
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'accessToken') {
      return decodeURIComponent(rest.join('=')) || null;
    }
  }
  return null;
}

function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name || user.firstName || 'Agent',
    email: user.email,
    role: user.role,
    active: user.isActive,
    organizationId: user.organizationId,
  };
}

export const authService = {
  publicUser,

  /**
   * Connexion API v1 (terminaux mobiles). Même mécanique que le login web :
   * JWT RS256 chiffré AES-GCM + session en base + refresh token haché.
   */
  async login(email: string, passwordPlain: string, meta: LoginMeta = {}) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { organization: { select: { isActive: true } } },
    });

    if (!user || user.isDeleted || !user.password) {
      await audit({
        action: 'LOGIN_FAILURE',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        status: 'FAILURE',
        metadata: { email: normalizedEmail, channel: 'api_v1', reason: 'Compte introuvable' },
      });
      throw new AuthError('Email ou mot de passe incorrect', 401);
    }

    // Backoff progressif (partagé avec le login web)
    const failedAttempts = await getFailedAttempts(user.id);
    if (failedAttempts >= appConfig.backoff.maxAttempts) {
      const lastFailed = await prisma.failedLoginAttempt.findFirst({
        where: { userId: user.id },
        orderBy: { attemptAt: 'desc' },
      });
      const elapsed = lastFailed ? Date.now() - lastFailed.attemptAt.getTime() : 0;
      const remaining = getBackoffDelay(failedAttempts) - elapsed;
      if (remaining > 0) {
        throw new AuthError(
          `Trop de tentatives. Réessayez dans ${Math.ceil(remaining / 60000)} minute(s).`,
          429
        );
      }
    }

    const isValid = await verifyPassword(passwordPlain, user.password);
    if (!isValid) {
      await incrementFailedAttempt(user.id);
      await audit({
        userId: user.id,
        action: 'LOGIN_FAILURE',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        status: 'FAILURE',
        metadata: { channel: 'api_v1', reason: 'Mot de passe incorrect' },
      });
      throw new AuthError('Email ou mot de passe incorrect', 401);
    }

    if (!user.isActive) {
      throw new AuthError("Votre compte est désactivé. Contactez l'administrateur.", 403);
    }

    if (!user.emailVerified) {
      throw new AuthError(
        'Adresse email non vérifiée. Validez votre compte depuis le portail web.',
        403
      );
    }

    if (user.organization && !user.organization.isActive) {
      throw new AuthError('Cet espace ScanHub est suspendu. Contactez le support.', 403);
    }

    await resetFailedAttempts(user.id);

    // 2FA TOTP : même challenge que le web, à finaliser via POST /api/auth/2fa/login
    if (user.isTwoFactorEnabled) {
      const tempToken = createEncryptedJWT({ userId: user.id, purpose: '2fa_challenge' }, '5m');
      return { requires2FA: true as const, tempToken };
    }

    const accessToken = createEncryptedJWT({ userId: user.id, email: user.email }, '1h');
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');

    // Un agent peut être connecté sur plusieurs terminaux : on n'invalide pas ses autres sessions.
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: accessToken,
        refreshToken: hashRefreshToken(rawRefreshToken),
        expires: new Date(Date.now() + ACCESS_TOKEN_TTL_SEC * 1000),
        refreshTokenExpires: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        lastActivity: new Date(),
        channel: 'api',
      },
    });

    await audit({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      status: 'SUCCESS',
      metadata: { email: user.email, channel: 'api_v1' },
    });

    return {
      requires2FA: false as const,
      user: publicUser(user),
      tokens: {
        accessToken,
        refreshToken: rawRefreshToken,
        expiresIn: ACCESS_TOKEN_TTL_SEC,
      },
    };
  },

  /**
   * Renouvelle le token d'accès à partir du refresh token (session en base).
   * Le refresh token n'est pas tourné : sur un réseau instable, une réponse perdue
   * verrouillerait le terminal en plein contrôle d'accès.
   */
  async refresh(rawRefreshToken: string) {
    const session = await prisma.session.findUnique({
      where: { refreshToken: hashRefreshToken(rawRefreshToken) },
      include: { user: true },
    });

    if (!session || session.isImpersonation || session.refreshTokenExpires < new Date()) {
      throw new AuthError('Refresh token invalide ou expiré', 401);
    }

    const { user } = session;
    if (!user.isActive || user.isDeleted) {
      await prisma.session.delete({ where: { id: session.id } });
      throw new AuthError('Utilisateur inactif ou révoqué', 401);
    }

    const accessToken = createEncryptedJWT({ userId: user.id, email: user.email }, '1h');

    await prisma.session.update({
      where: { id: session.id },
      data: {
        sessionToken: accessToken,
        expires: new Date(Date.now() + ACCESS_TOKEN_TTL_SEC * 1000),
        lastActivity: new Date(),
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SEC,
    };
  },

  /** Ferme uniquement la session portée par ce token d'accès. */
  async logout(ctx: AuthContext, meta: LoginMeta = {}) {
    await prisma.session.deleteMany({ where: { id: ctx.session.id } });
    await audit({
      userId: ctx.user.id,
      action: 'LOGOUT',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      status: 'SUCCESS',
      metadata: { channel: 'api_v1' },
    });
  },

  /**
   * Authentifie une requête : signature + chiffrement du JWT, session encore
   * active en base (révocable), compte actif.
   */
  async authenticate(request: Request): Promise<AuthContext | null> {
    const token = extractToken(request);
    if (!token) return null;

    const payload = getFullTokenPayload(token);
    if (!payload) return null;

    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: { user: { include: { organization: { select: { isActive: true } } } } },
    });

    if (!session || session.userId !== payload.userId || session.expires < new Date()) {
      return null;
    }

    const { user: userWithOrganization, ...sessionOnly } = session;
    const { organization, ...user } = userWithOrganization;
    if (!user.isActive || user.isDeleted) return null;
    // Espace suspendu par le propriétaire de la plateforme : plus aucun accès
    if (organization && !organization.isActive) return null;

    return { user, session: sessionOnly, token };
  },

  async authenticateRequest(request: Request): Promise<User | null> {
    const ctx = await this.authenticate(request);
    return ctx?.user ?? null;
  },
};
