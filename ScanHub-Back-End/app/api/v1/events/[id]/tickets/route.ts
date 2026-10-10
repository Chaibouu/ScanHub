import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { authorizeUser, ADMIN_ROLES } from '@/lib/rbac';
import { scope, toViewer } from '@/lib/tenant';
import { ticketService } from '@/modules/tickets/ticketService';

/**
 * Billets d'un événement, avec leur token (contenu du QR code).
 * Réservé aux administrateurs de l'espace : ces tokens SONT les billets.
 *   ?format=csv → fichier à ouvrir dans Excel (publipostage, envoi des billets…)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeUser(req, ADMIN_ROLES);
    if (!auth.authorized) {
      return jsonError(auth.error, auth.status);
    }

    const { id } = await params;
    const event = await prisma.event.findFirst({
      where: { id, ...scope.events(toViewer(auth.user)) },
      select: { id: true, name: true },
    });
    if (!event) {
      return jsonError('Événement introuvable', 404);
    }

    const tickets = await ticketService.listWithTokens(event.id);

    if (req.nextUrl.searchParams.get('format') !== 'csv') {
      return jsonSuccess({ event, tickets });
    }

    const rows = [
      ['Nom', 'Email', 'Categorie', 'Type', 'Statut', 'Code_QR'].join(';'),
      ...tickets.map((t) =>
        [t.holderName, t.holderEmail, t.holderRole, t.type, t.status, t.token ?? '']
          .map(escapeCsv)
          .join(';')
      ),
    ];

    return new NextResponse('﻿' + rows.join('\r\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="billets_${event.id}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la récupération des billets');
  }
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  let str = String(val);
  // Neutralise l'injection de formules dans Excel / LibreOffice
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  str = str.replace(/"/g, '""');
  return /[;"\r\n]/.test(str) ? `"${str}"` : str;
}
