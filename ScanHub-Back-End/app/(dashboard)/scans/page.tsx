import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Download, QrCode, CheckCircle2, AlertTriangle, Clock, RefreshCw } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; eventId?: string }>;
}) {
  const params = await searchParams;
  const resultFilter = params.result;
  const eventFilter = params.eventId;

  const whereClause: any = {};
  if (resultFilter) {
    whereClause.result = resultFilter;
  }
  if (eventFilter) {
    whereClause.eventId = eventFilter;
  }

  const [scans, totalCount, events] = await Promise.all([
    prisma.scan.findMany({
      where: whereClause,
      take: 50,
      orderBy: { scannedAt: "desc" },
      include: {
        qr: true,
        event: true,
        user: true,
      },
    }),
    prisma.scan.count({ where: whereClause }),
    prisma.event.findMany({ select: { id: true, name: true } }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Journal des Scans & Contrôles
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Traçabilité intégrale de chaque tentative de scan, statut et horodatage.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/api/v1/scans?format=csv${resultFilter ? `&result=${resultFilter}` : ""}${eventFilter ? `&eventId=${eventFilter}` : ""}`}
            target="_blank"
          >
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exporter (.CSV)
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtres rapides */}
      <div className="flex flex-wrap gap-2 items-center">
        <Link href="/scans">
          <Button
            size="sm"
            variant={!resultFilter ? "default" : "outline"}
            className="text-xs"
          >
            Tous ({totalCount})
          </Button>
        </Link>
        <Link href="/scans?result=VALID">
          <Button
            size="sm"
            variant={resultFilter === "VALID" ? "default" : "outline"}
            className="text-xs text-emerald-600 dark:text-emerald-400"
          >
            Validés
          </Button>
        </Link>
        <Link href="/scans?result=ALREADY_USED">
          <Button
            size="sm"
            variant={resultFilter === "ALREADY_USED" ? "default" : "outline"}
            className="text-xs text-red-600 dark:text-red-400"
          >
            Déjà Utilisés
          </Button>
        </Link>
        <Link href="/scans?result=EXPIRED">
          <Button
            size="sm"
            variant={resultFilter === "EXPIRED" ? "default" : "outline"}
            className="text-xs text-amber-600 dark:text-amber-400"
          >
            Expirés
          </Button>
        </Link>
        <Link href="/scans?result=REVOKED">
          <Button
            size="sm"
            variant={resultFilter === "REVOKED" ? "default" : "outline"}
            className="text-xs text-rose-600 dark:text-rose-400"
          >
            Révoqués
          </Button>
        </Link>
      </div>

      {/* Tableau des scans */}
      <Card className="border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-gray-100 dark:border-gray-800">
          <CardTitle className="text-sm font-semibold">
            {scans.length} scans affichés
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                  <th className="py-3 px-6">Résultat</th>
                  <th className="py-3 px-6">Bénéficiaire / Métadonnées</th>
                  <th className="py-3 px-6">Type QR</th>
                  <th className="py-3 px-6">Événement</th>
                  <th className="py-3 px-6">Mode</th>
                  <th className="py-3 px-6">Agent / Terminal</th>
                  <th className="py-3 px-6">Date du Scan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {scans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      Aucun scan ne correspond aux critères sélectionnés.
                    </td>
                  </tr>
                ) : (
                  scans.map((scan) => {
                    const meta = (scan.metadata as any) || (scan.qr?.metadata as any) || {};
                    const isSuccess = scan.result === "VALID";
                    return (
                      <tr
                        key={scan.id}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors"
                      >
                        <td className="py-3 px-6">
                          <Badge
                            className={`text-xs px-2.5 py-0.5 font-semibold ${
                              isSuccess
                                ? "bg-emerald-600 text-white"
                                : scan.result === "ALREADY_USED"
                                ? "bg-red-600 text-white"
                                : scan.result === "EXPIRED"
                                ? "bg-amber-600 text-white"
                                : "bg-gray-600 text-white"
                            }`}
                          >
                            {scan.result}
                          </Badge>
                        </td>
                        <td className="py-3 px-6">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {meta.holderName || "Anonyme"}
                          </div>
                          <div className="text-xs text-gray-500">
                            {meta.holderRole || meta.ticketClass || "Accès standard"}
                          </div>
                        </td>
                        <td className="py-3 px-6">
                          <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-700 dark:text-gray-300">
                            {scan.qr?.type || "QR"}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-xs text-gray-600 dark:text-gray-300">
                          {scan.event?.name || "Non assigné"}
                        </td>
                        <td className="py-3 px-6">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              scan.offline
                                ? "border-amber-500/50 text-amber-600"
                                : "border-emerald-500/50 text-emerald-600"
                            }`}
                          >
                            {scan.offline ? "Hors-ligne" : "En direct"}
                          </Badge>
                        </td>
                        <td className="py-3 px-6 text-xs">
                          <div className="text-gray-900 dark:text-white font-medium">
                            {scan.user?.name || "Agent"}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {scan.deviceId ? `Terminal: ${scan.deviceId.slice(0, 8)}` : "App Mobile"}
                          </div>
                        </td>
                        <td className="py-3 px-6 text-xs text-gray-500">
                          {new Date(scan.scannedAt).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
