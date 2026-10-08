/**
 * Logger structuré — Pino
 *
 * Dev  : sortie colorée lisible (pino-pretty)
 * Prod : JSON brut → compatible Datadog, Grafana Loki, CloudWatch…
 *
 * Usage :
 *   import { logger } from '@/lib/logger';
 *   logger.info({ userId, action: 'LOGIN' }, 'Connexion réussie');
 *   logger.error({ err }, 'Erreur serveur');
 *   logger.logAuth('LOGIN_SUCCESS', userId, email);
 */

import pino, { Logger as PinoLogger } from "pino";

const isDev = process.env.NODE_ENV !== "production";

const options: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: { app: "scanhub-backend", env: process.env.NODE_ENV ?? "development" },
  timestamp: pino.stdTimeFunctions.isoTime,
};

/**
 * En dev, pino-pretty est branché comme flux synchrone dans le même thread.
 * L'option `transport` de Pino lance un worker thread dont le fichier n'existe plus
 * une fois le code bundlé par Next.js ("Cannot find module …/lib/worker.js").
 */
function createLogger(): PinoLogger {
  if (isDev && process.env.NODE_ENV !== "test") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pretty = require("pino-pretty");
      return pino(
        options,
        pretty({
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname,app,env",
          sync: true,
        })
      );
    } catch {
      // pino-pretty absent (devDependency) : repli sur le JSON brut
    }
  }
  return pino(options);
}

const base = createLogger();

/** Masque la partie locale d'un email pour les logs : jo***@example.com */
export function maskEmail(email?: string): string | undefined {
  return email ? email.replace(/^(.{2})(.*)(@.*)$/, "$1***$3") : undefined;
}

// ─── Wrapper avec méthodes métier ─────────────────────────────────────────────

class AppLogger {
  // Accès direct aux niveaux Pino
  readonly trace = base.trace.bind(base);
  readonly debug = base.debug.bind(base);
  readonly info  = base.info.bind(base);
  readonly warn  = base.warn.bind(base);
  readonly error = base.error.bind(base);
  readonly fatal = base.fatal.bind(base);

  /** Log d'une requête HTTP */
  logRequest(method: string, path: string, statusCode: number, durationMs: number) {
    base.info({ method, path, statusCode, durationMs }, "HTTP Request");
  }

  /** Log d'une action d'authentification — masque l'email */
  logAuth(action: string, userId?: string, email?: string) {
    base.info(
      {
        action,
        userId,
        email: maskEmail(email),
      },
      `Auth: ${action}`
    );
  }

  /** Log d'une opération base de données */
  logDatabase(operation: string, table: string, durationMs?: number) {
    base.debug({ operation, table, durationMs }, `DB: ${operation} on ${table}`);
  }

  /** Log de sécurité — niveau warn par défaut */
  logSecurity(event: string, context?: Record<string, unknown>) {
    base.warn({ event, ...context }, `Security: ${event}`);
  }
}

export const logger = new AppLogger();
export default logger;

// Types utilitaires
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
