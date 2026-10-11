import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { authenticateIntegration } from '@/lib/integrationAuth';
import { integrationService } from '@/modules/integrations/integrationService';
import { jsonError, jsonServerError } from '@/lib/response';

/**
 * GET /api/v1/integrations/qrs/:id/image — image du QR code, prête à afficher ou imprimer.
 *   ?format=png (défaut) | svg      ?size=64…1024 (pixels, défaut 300)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateIntegration(req);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const qr = await integrationService.findQRCode(decodeURIComponent(id), auth.source.id);
    if (!qr) return jsonError('QR Code introuvable.', 404);

    const token = integrationService.readToken(qr);
    if (!token) {
      return jsonError(
        "ScanHub ne détient pas de copie de ce code : générez l'image à partir du token reçu à la création.",
        409
      );
    }

    const search = req.nextUrl.searchParams;
    const size = Math.min(Math.max(parseInt(search.get('size') || '300', 10) || 300, 64), 1024);
    // L'image EST le billet : elle ne doit jamais être mise en cache par un intermédiaire
    const headers = { 'Cache-Control': 'private, no-store' };

    if (search.get('format') === 'svg') {
      const svg = await QRCode.toString(token, { type: 'svg', margin: 1, width: size });
      return new NextResponse(svg, { headers: { ...headers, 'Content-Type': 'image/svg+xml' } });
    }

    const png = await QRCode.toBuffer(token, { margin: 1, width: size });
    return new NextResponse(new Uint8Array(png), {
      headers: { ...headers, 'Content-Type': 'image/png' },
    });
  } catch (error) {
    return jsonServerError(error, "Erreur lors de la génération de l'image du QR code");
  }
}
