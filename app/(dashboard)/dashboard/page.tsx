import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getViewer, scope } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  Smartphone, 
  Calendar, 
  Download, 
  ArrowUpRight 
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/login");

  let totalScans = 0;
  let validScans = 0;
  let rejectedScans = 0;
  let totalQRs = 0;
  let totalDevices = 0;
  let activeEventsCount = 0;
  let recentScans: any[] = [];
  let events: any[] = [];

  try {
    const [
      scansCount,
      validCount,
      rejectedCount,
      qrCount,
      devicesCount,
      eventsList,
      recentScansList,
    ] = await Promise.all([
      prisma.scan.count({ where: scope.scans(viewer) }),
      prisma.scan.count({ where: { ...scope.scans(viewer), result: "VALID" } }),
      prisma.scan.count({ where: { ...scope.scans(viewer), result: { not: "VALID" } } }),
      prisma.qRCode.count({ where: scope.qrCodes(viewer) }),
      prisma.device.count({ where: { ...scope.devices(viewer), active: true } }),
      prisma.event.findMany({
        where: scope.events(viewer),
        take: 3,
        orderBy: { startsAt: "desc" },
        include: {
          _count: {
            select: { qrCodes: true, scans: true },
          },
        },
      }),
      prisma.scan.findMany({
        where: scope.scans(viewer),
        take: 6,
        orderBy: { scannedAt: "desc" },
        include: {
          qr: true,
          event: true,
          user: true,
        },
      }),
    ]);

    totalScans = scansCount;
    validScans = validCount;
    rejectedScans = rejectedCount;
    totalQRs = qrCount;
    totalDevices = devicesCount;
    events = eventsList;
    recentScans = recentScansList;
    activeEventsCount = eventsList.length;
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques ScanHub:", error);
  }

  const successRate = totalScans > 0 ? Math.round((validScans / totalScans) * 100) : 100;

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Tableau de Bord ScanHub
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Supervision centralisée du contrôle d'accès et des flux de scans en direct.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/api/v1/scans?format=csv" target="_blank">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exporter Scans (CSV)
            </Button>
          </Link>
          <Link href="/scans">
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
              <QrCode className="h-4 w-4" />
              Direct Contrôles
            </Button>
          </Link>
        </div>
      </div>

      {/* Cartes KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Scans
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <QrCode className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalScans}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Synchronisés & vérifiés
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Accès Validés
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {validScans}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Taux de succès : <span className="font-semibold">{successRate}%</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Rejets / Fraudes
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {rejectedScans}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Doublons, expirés ou révoqués
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Terminaux Actifs
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600">
              <Smartphone className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalDevices}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {totalQRs} billets & badges répertoriés
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grille principale : Scans récents + Événements */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Scans en direct (4 colonnes) */}
        <Card className="lg:col-span-4 border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Derniers Scans Réalisés
              </CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Flux en temps réel de tous les points de contrôle
              </p>
            </div>
            <Link href="/scans">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-blue-600">
                Tout voir <ArrowUpRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentScans.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-500">
                Aucun scan enregistré pour le moment.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentScans.map((scan) => {
                  const meta = (scan.metadata as any) || (scan.qr?.metadata as any) || {};
                  const isSuccess = scan.result === "VALID";
                  return (
                    <div
                      key={scan.id}
                      className="py-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isSuccess
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-red-500/10 text-red-600"
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {meta.holderName || scan.qr?.type || "Billet d'accès"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {scan.event?.name || "Événement"} • Agent : {scan.user?.name || "Agent"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge
                          variant={isSuccess ? "default" : "destructive"}
                          className={`text-[10px] px-2 py-0.5 font-semibold ${
                            isSuccess
                              ? "bg-emerald-600 text-white"
                              : "bg-red-600 text-white"
                          }`}
                        >
                          {scan.result}
                        </Badge>
                        <span className="text-[10px] text-gray-400">
                          {new Date(scan.scannedAt).toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Événements & Accès Rapides (3 colonnes) */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  Événements Récents
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Gestion des jauges et billetteries
                </p>
              </div>
              <Link href="/events">
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-blue-600">
                  Gérer <ArrowUpRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-6 text-sm text-gray-500">
                  Aucun événement configuré.
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((evt) => {
                    const total = evt._count.qrCodes || 0;
                    const scanned = evt._count.scans || 0;
                    const pct = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;
                    return (
                      <div
                        key={evt.id}
                        className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {evt.name}
                          </h4>
                          <Badge variant="outline" className="text-[10px]">
                            {evt.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Jauge scannée</span>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {scanned} / {total} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Raccourcis Rapides */}
          <Card className="border-border/40 shadow-sm bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
            <CardContent className="pt-6 space-y-3">
              <h3 className="font-bold text-lg">Application Mobile ScanHub</h3>
              <p className="text-xs text-blue-100 leading-relaxed">
                Les agents de terrain peuvent utiliser l'application mobile Expo pour scanner
                les billets en ligne ou 100% hors-ligne avec synchronisation automatique.
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <Link href="/devices">
                  <Button size="sm" variant="secondary" className="text-xs font-semibold">
                    Activer un Terminal
                  </Button>
                </Link>
                <Link href="/integrations">
                  <Button size="sm" variant="outline" className="text-xs bg-white/10 hover:bg-white/20 text-white border-white/20">
                    Clés API Partenaires
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}