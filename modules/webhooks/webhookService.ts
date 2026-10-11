import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateSecret } from '@/lib/crypto';
import { decryptSecret, encryptSecret } from '@/lib/tokens';
import { formatScanForApi, SCAN_API_INCLUDE } from '@/modules/integrations/scanFormat';

/**
 * Webhooks : ScanHub prévient les plateformes clientes à chaque scan, sans qu'elles
 * aient à interroger l'API.
 *
 * - Chaque envoi est signé (HMAC-SHA256) avec le secret de l'adresse.
 * - Un envoi en échec est retenté avec un délai croissant ; chaque tentative est tracée
 *   dans WebhookDelivery, qui sert aussi de journal dans le tableau de bord.
 * - Sans processus de fond (hébergement serverless), les nouvelles tentatives sont rejouées
 *   à l'occasion des scans suivants et par la route planifiable /api/cron/webhooks.
 */

export class WebhookError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = 'WebhookError';
  }
}

export const WEBHOOK_EVENTS = ['scan.created', 'ping'] as const;
export const MAX_ENDPOINTS_PER_ORGANIZATION = 5;

const TIMEOUT_MS = 8000;
// Délai avant la tentative suivante, en minutes. 6 tentatives au total, sur ~15 heures.
const RETRY_DELAYS_MIN = [1, 5, 30, 120, 720];
// Une adresse qui échoue sans arrêt est désactivée pour ne pas accumuler les envois perdus
const MAX_CONSECUTIVE_FAILURES = 30;

/** Exécute une tâche après la réponse HTTP quand c'est possible, sinon en arrière-plan. */
function runInBackground(task: () => Promise<void>) {
  const safe = () =>
    task().catch((err) => logger.error({ err }, 'Tâche webhook en arrière-plan en échec'));

  import('next/server')
    .then(({ after }) => after(safe))
    .catch(() => {
      // Hors d'une requête Next.js (scripts, tests) : exécution directe, sans attendre
      void safe();
    });
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) {
    return host.includes(':');
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * Valide l'adresse de réception. En production : HTTPS obligatoire et aucune adresse
 * interne (le serveur ScanHub ne doit pas pouvoir être utilisé pour sonder un réseau privé).
 */
export function validateWebhookUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new WebhookError('Adresse invalide.', 422);
  }
  if (url.username || url.password) {
    throw new WebhookError("L'adresse ne doit pas contenir d'identifiants.", 422);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new WebhookError("L'adresse doit commencer par https://", 422);
  }
  if (process.env.NODE_ENV === 'production') {
    if (url.protocol !== 'https:') {
      throw new WebhookError("L'adresse doit commencer par https://", 422);
    }
    if (isPrivateHost(url.hostname)) {
      throw new WebhookError('Adresse interne non autorisée.', 422);
    }
  }
  return url.toString();
}

/** Signature à vérifier côté client : HMAC-SHA256 de `${timestamp}.${corps}`. */
export function signWebhook(secret: string, timestamp: number, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

function publicEndpoint(endpoint: {
  id: string;
  url: string;
  isActive: boolean;
  consecutiveFailures: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: endpoint.id,
    url: endpoint.url,
    active: endpoint.isActive,
    consecutiveFailures: endpoint.consecutiveFailures,
    lastSuccessAt: endpoint.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: endpoint.lastFailureAt?.toISOString() ?? null,
    createdAt: endpoint.createdAt.toISOString(),
  };
}

async function enqueue(endpointIds: string[], event: string, data: Record<string, unknown>) {
  const deliveries = await prisma.webhookDelivery.createManyAndReturn({
    data: endpointIds.map((endpointId) => ({
      endpointId,
      event,
      // Tenté tout de suite par l'appelant ; cette échéance ne sert que de filet si le
      // processus s'arrête avant (l'envoi est alors repris par processDue).
      nextAttemptAt: new Date(Date.now() + 60_000),
      payload: { type: event, createdAt: new Date().toISOString(), data } as Prisma.InputJsonObject,
    })),
    select: { id: true },
  });
  return deliveries.map((d) => d.id);
}

export const webhookService = {
  publicEndpoint,

  async list(organizationId: string) {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return endpoints.map(publicEndpoint);
  },

  /** Crée une adresse de réception. Le secret de signature n'est retourné qu'ici, une seule fois. */
  async create(organizationId: string, rawUrl: string) {
    const url = validateWebhookUrl(rawUrl);

    const count = await prisma.webhookEndpoint.count({ where: { organizationId } });
    if (count >= MAX_ENDPOINTS_PER_ORGANIZATION) {
      throw new WebhookError(
        `Maximum ${MAX_ENDPOINTS_PER_ORGANIZATION} adresses de webhook par espace.`,
        403
      );
    }

    const secret = generateSecret('whsec');
    const endpoint = await prisma.webhookEndpoint.create({
      data: { organizationId, url, secretEnc: encryptSecret(secret) },
    });
    return { endpoint: publicEndpoint(endpoint), secret };
  },

  async remove(organizationId: string, endpointId: string) {
    const { count } = await prisma.webhookEndpoint.deleteMany({
      where: { id: endpointId, organizationId },
    });
    if (count === 0) throw new WebhookError('Webhook introuvable.', 404);
  },

  async setActive(organizationId: string, endpointId: string, active: boolean) {
    const { count } = await prisma.webhookEndpoint.updateMany({
      where: { id: endpointId, organizationId },
      data: { isActive: active, ...(active ? { consecutiveFailures: 0 } : {}) },
    });
    if (count === 0) throw new WebhookError('Webhook introuvable.', 404);
  },

  /** Derniers envois d'une adresse (journal). */
  async recentDeliveries(organizationId: string, endpointId: string, take = 20) {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, organizationId },
    });
    if (!endpoint) throw new WebhookError('Webhook introuvable.', 404);

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        event: true,
        status: true,
        attempts: true,
        lastStatusCode: true,
        lastError: true,
        createdAt: true,
        deliveredAt: true,
        nextAttemptAt: true,
      },
    });
    return { endpoint: publicEndpoint(endpoint), deliveries };
  },

  /** Envoie un événement `ping` pour vérifier que l'adresse répond. Attend le résultat. */
  async sendTest(organizationId: string, endpointId: string) {
    const endpoint = await prisma.webhookEndpoint.findFirst({
      where: { id: endpointId, organizationId },
      select: { id: true },
    });
    if (!endpoint) throw new WebhookError('Webhook introuvable.', 404);

    const [deliveryId] = await enqueue([endpoint.id], 'ping', {
      message: 'Test de connexion ScanHub',
    });
    return this.deliver(deliveryId);
  },

  /**
   * Notifie les adresses actives de l'espace qu'un scan vient d'être enregistré.
   * Ne bloque jamais le scan : tout se passe après la réponse à l'agent.
   */
  emitScanCreated(scanId: string) {
    runInBackground(async () => {
      const scan = await prisma.scan.findUnique({
        where: { id: scanId },
        include: SCAN_API_INCLUDE,
      });
      if (!scan?.organizationId) return;

      const endpoints = await prisma.webhookEndpoint.findMany({
        where: { organizationId: scan.organizationId, isActive: true },
        select: { id: true },
      });
      if (endpoints.length === 0) return;

      const deliveryIds = await enqueue(
        endpoints.map((e) => e.id),
        'scan.created',
        { scan: formatScanForApi(scan) }
      );
      await Promise.all(deliveryIds.map((id) => this.deliver(id)));

      // Profite de l'activité pour rejouer les envois en attente de cet espace
      await this.processDue(10, scan.organizationId);
    });
  },

  /** Tente un envoi et enregistre le résultat. */
  async deliver(deliveryId: string) {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });
    if (!delivery || delivery.status === 'SUCCESS') return { ok: delivery?.status === 'SUCCESS' };

    const body = JSON.stringify({ id: delivery.id, ...(delivery.payload as object) });
    const timestamp = Math.floor(Date.now() / 1000);
    const attempts = delivery.attempts + 1;

    let statusCode: number | null = null;
    let error: string | null = null;

    try {
      const secret = decryptSecret(delivery.endpoint.secretEnc);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(delivery.endpoint.url, {
          method: 'POST',
          // Une redirection pourrait renvoyer vers une adresse interne : on ne la suit pas
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'ScanHub-Webhooks/1.0',
            'ScanHub-Event': delivery.event,
            'ScanHub-Delivery': delivery.id,
            'ScanHub-Signature': `t=${timestamp},v1=${signWebhook(secret, timestamp, body)}`,
          },
          body,
        });
        statusCode = res.status;
        if (res.status < 200 || res.status >= 300) error = `Réponse HTTP ${res.status}`;
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      error =
        (err as Error)?.name === 'AbortError'
          ? `Délai dépassé (${TIMEOUT_MS / 1000} s)`
          : ((err as Error)?.message ?? 'Erreur réseau').slice(0, 300);
    }

    const now = new Date();

    if (!error) {
      await prisma.$transaction([
        prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'SUCCESS',
            attempts,
            lastStatusCode: statusCode,
            lastError: null,
            deliveredAt: now,
            nextAttemptAt: null,
          },
        }),
        prisma.webhookEndpoint.update({
          where: { id: delivery.endpointId },
          data: { consecutiveFailures: 0, lastSuccessAt: now },
        }),
      ]);
      return { ok: true, statusCode };
    }

    const delay = RETRY_DELAYS_MIN[attempts - 1];
    const exhausted = delay === undefined;
    const failures = delivery.endpoint.consecutiveFailures + 1;

    await prisma.$transaction([
      prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: exhausted ? 'FAILED' : 'PENDING',
          attempts,
          lastStatusCode: statusCode,
          lastError: error,
          nextAttemptAt: exhausted ? null : new Date(now.getTime() + delay * 60_000),
        },
      }),
      prisma.webhookEndpoint.update({
        where: { id: delivery.endpointId },
        data: {
          consecutiveFailures: failures,
          lastFailureAt: now,
          ...(failures >= MAX_CONSECUTIVE_FAILURES ? { isActive: false } : {}),
        },
      }),
    ]);
    return { ok: false, statusCode, error };
  },

  /** Rejoue les envois dont l'heure de nouvelle tentative est passée. */
  async processDue(limit = 50, organizationId?: string) {
    const due = await prisma.webhookDelivery.findMany({
      where: {
        status: 'PENDING',
        nextAttemptAt: { lte: new Date() },
        endpoint: { isActive: true, ...(organizationId ? { organizationId } : {}) },
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
      select: { id: true },
    });

    let delivered = 0;
    for (const { id } of due) {
      if ((await this.deliver(id)).ok) delivered++;
    }
    return { processed: due.length, delivered };
  },
};
