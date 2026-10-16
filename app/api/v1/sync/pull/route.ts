import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { authorizeScanRequest } from '@/lib/scanAuth';
import { scope, toViewer } from '@/lib/tenant';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';

export async function GET(req: NextRequest) {
  try {
    // Session de l'agent et terminal vérifiés en parallèle
    const scanAuth = await authorizeScanRequest(req);
    if (!scanAuth.ok) return scanAuth.response;
    const { user } = scanAuth;

    const searchParams = req.nextUrl.searchParams;
    const eventId = searchParams.get('eventId') || undefined;
    const sinceParam = searchParams.get('since') || undefined;

    // Le cache hors-ligne est toujours limité à un événement : pas d'export global de l'annuaire
    if (!eventId) {
      return jsonError('Paramètre eventId requis', 400);
    }

    const since = sinceParam ? new Date(sinceParam) : undefined;
    if (since && Number.isNaN(since.getTime())) {
      return jsonError('Paramètre since invalide (date ISO attendue)', 400);
    }

    // L'événement doit appartenir à l'espace de l'opérateur
    const event = await prisma.event.findFirst({
      where: { id: eventId, ...scope.events(toViewer(user)) },
      select: { id: true },
    });
    if (!event) {
      return jsonError('Événement introuvable', 404);
    }

    const qrs = await prisma.qRCode.findMany({
      where: {
        eventId,
        offlineHash: { not: null },
        ...(since ? { updatedAt: { gte: since } } : {}),
      },
      select: {
        id: true,
        offlineHash: true,
        type: true,
        status: true,
        reusable: true,
        eventId: true,
        expiresAt: true,
        metadata: true,
        updatedAt: true,
      },
    });

    const offlineQRs = qrs.map((qr) => {
      const meta = (qr.metadata as Record<string, any>) || {};
      const holderName = meta.holderName || meta.name || undefined;
      const holderRole = meta.holderRole || meta.role || meta.ticketType || undefined;
      return {
        id: qr.id,
        // SHA-256(token) sans pepper : le terminal le recalcule localement à partir du QR scanné
        tokenHash: qr.offlineHash,
        type: qr.type,
        status: qr.status,
        reusable: qr.reusable,
        eventId: qr.eventId || '',
        holderName,
        holderRole,
        expiresAt: qr.expiresAt ? qr.expiresAt.toISOString() : undefined,
        // Minimisation : seules les données utiles à l'affichage du contrôle quittent le serveur
        metadataJson: JSON.stringify({ holderName, holderRole, company: meta.company }),
        updatedAt: qr.updatedAt.toISOString(),
      };
    });

    return jsonSuccess({
      eventId,
      syncedAt: new Date().toISOString(),
      qrs: offlineQRs,
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la synchronisation descendante (pull)');
  }
}
