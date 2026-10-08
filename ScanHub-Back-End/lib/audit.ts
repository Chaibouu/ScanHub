/**
 * Helper AuditLog — traçabilité des actions sensibles
 *
 * Usage :
 *   await audit({ userId, action: 'LOGIN_SUCCESS', ipAddress, status: 'SUCCESS' });
 *
 * Actions définies :
 *   AUTH     → LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, SIGNUP
 *   SECURITY → 2FA_ENABLED, 2FA_DISABLED, 2FA_FAILURE, PASSWORD_RESET, PASSWORD_CHANGED
 *   ADMIN    → IMPERSONATION_START, IMPERSONATION_END
 *   ACCOUNT  → EMAIL_CHANGED, ACCOUNT_DISABLED, ACCOUNT_DELETED
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

export type AuditAction =
  // Auth
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "SIGNUP"
  // Sécurité
  | "2FA_ENABLED"
  | "2FA_DISABLED"
  | "2FA_FAILURE"
  | "2FA_SUCCESS"
  | "PASSWORD_RESET"
  | "PASSWORD_CHANGED"
  // Admin
  | "IMPERSONATION_START"
  | "IMPERSONATION_END"
  // Compte
  | "EMAIL_CHANGED"
  | "ACCOUNT_DISABLED"
  | "ACCOUNT_DELETED";

interface AuditParams {
  userId?: string;
  action: AuditAction;
  ipAddress?: string;
  userAgent?: string;
  status: "SUCCESS" | "FAILURE";
  metadata?: Record<string, unknown>;
}

/**
 * Enregistre un événement dans l'AuditLog.
 * Non-bloquant : les erreurs d'écriture ne propagent pas (sécurité > disponibilité).
 */
export async function audit(params: AuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        status: params.status,
        metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : undefined,
      },
    });

    // Log structuré en parallèle pour la recherche rapide dans les logs applicatifs
    logger.logAuth(params.action, params.userId, params.metadata?.email as string | undefined);
  } catch (err) {
    // Ne jamais bloquer le flux principal sur une erreur d'audit
    logger.error({ err, action: params.action }, "Erreur écriture AuditLog");
  }
}
