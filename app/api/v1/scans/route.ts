import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { jsonSuccess, jsonError, jsonServerError } from '@/lib/response';
import { authorizeUser } from '@/lib/rbac';
import { scope, toViewer } from '@/lib/tenant';
import { Prisma, ScanResult } from '@prisma/client';

const MAX_PAGE_SIZE = 200;
const MAX_CSV_ROWS = 50_000;

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeUser(req);
    if (!auth.authorized) {
      return jsonError(auth.error, auth.status);
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');
    const resultFilter = searchParams.get('result');
    const offlineFilter = searchParams.get('offline');
    const format = searchParams.get('format');
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1),
      MAX_PAGE_SIZE
    );

    if (resultFilter && !(resultFilter in ScanResult)) {
      return jsonError('Paramètre result invalide', 400);
    }

    const where: Prisma.ScanWhereInput = { ...scope.scans(toViewer(auth.user)) };
    if (eventId) where.eventId = eventId;
    if (resultFilter) where.result = resultFilter as ScanResult;
    if (offlineFilter) where.offline = offlineFilter === 'true';
    // Un agent ne consulte que ses propres scans ; les administrateurs voient tout
    if (auth.user.role === 'AGENT') where.userId = auth.user.id;

    // 1. Export CSV
    if (format === 'csv') {
      const allScans = await prisma.scan.findMany({
        where,
        orderBy: { scannedAt: 'desc' },
        take: MAX_CSV_ROWS,
        include: {
          qr: { include: { source: true } },
          event: true,
          user: { select: { name: true, firstName: true } },
        },
      });

      const csvRows = [
        [
          'ID_Scan',
          'Date',
          'Heure',
          'Resultat',
          'Token_ID',
          'Nom_Titulaire',
          'Categorie_Role',
          'Type_Document',
          'Plateforme_Source',
          'Evenement',
          'Operateur',
          'Mode_Offline',
          'Client_UUID',
        ].join(';'),
      ];

      for (const s of allScans) {
        const meta: any = s.metadata || s.qr?.metadata || {};
        const dateObj = new Date(s.scannedAt);

        const row = [
          s.id,
          dateObj.toLocaleDateString('fr-FR'),
          dateObj.toLocaleTimeString('fr-FR'),
          s.result,
          s.qr?.id || 'Inconnu',
          meta.holderName || meta.name || 'Participant',
          meta.ticketType || meta.holderRole || meta.role || '',
          s.qr?.type || 'INCONNU',
          s.qr?.source?.name || 'ScanHub',
          s.event?.name || 'N/A',
          s.user?.name || s.user?.firstName || s.deviceId || 'Terminal',
          s.offline ? 'OUI' : 'NON',
          s.clientId || '',
        ];
        csvRows.push(row.map(escapeCsv).join(';'));
      }

      // Add UTF-8 BOM so Excel opens accents properly
      const csvContent = '﻿' + csvRows.join('\r\n');
      const filename = `scans_export_${new Date().toISOString().slice(0, 10)}.csv`;

      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 2. Standard JSON query with pagination
    const [totalCount, scans] = await Promise.all([
      prisma.scan.count({ where }),
      prisma.scan.findMany({
        where,
        orderBy: { scannedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          qr: { include: { source: true } },
          event: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, firstName: true } },
        },
      }),
    ]);

    const formatted = scans.map((s) => {
      const meta: any = s.metadata || s.qr?.metadata || {};
      return {
        id: s.id,
        clientId: s.clientId,
        result: s.result,
        offline: s.offline,
        scannedAt: s.scannedAt.toISOString(),
        holderName: meta.holderName || meta.name || 'Participant',
        role: meta.ticketType || meta.holderRole || '',
        qrType: s.qr?.type || 'TICKET',
        source: s.qr?.source?.name || 'ScanHub',
        event: s.event?.name || 'N/A',
        agent: s.user?.name || s.user?.firstName || 'Agent',
      };
    });

    return jsonSuccess({
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      scans: formatted,
    });
  } catch (error) {
    return jsonServerError(error, 'Erreur lors de la récupération des scans');
  }
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  let str = String(val);
  // Neutralise l'injection de formules dans Excel / LibreOffice (=, +, -, @ en tête de cellule)
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  str = str.replace(/"/g, '""');
  return /[;"\r\n]/.test(str) ? `"${str}"` : str;
}
