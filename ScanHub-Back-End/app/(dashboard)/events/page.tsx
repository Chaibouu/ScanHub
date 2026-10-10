import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { QrCode, Building } from "lucide-react";
import { getUser } from "@/actions/getUser";
import { CreateEventForm } from "@/components/events/CreateEventForm";
import { EventStatusActions } from "@/components/events/EventStatusActions";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const session = await getUser();
  const role = session?.user?.user?.role;
  // Les formulaires ne sont proposés qu'aux administrateurs ; les actions serveur revérifient le rôle
  const isAdmin = !session?.isImpersonation && (role === "ADMIN" || role === "SUPER_ADMIN");

  const [events, organizations, sources] = await Promise.all([
    prisma.event.findMany({
      orderBy: { startsAt: "desc" },
      include: {
        organization: true,
        source: true,
        _count: {
          select: { qrCodes: true, scans: true },
        },
      },
    }),
    isAdmin
      ? prisma.organization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [],
    isAdmin
      ? prisma.source.findMany({
          select: { id: true, name: true, organizationId: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Événements & Billetteries
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configuration des événements, dates et jauges de contrôle d'accès.
          </p>
        </div>
      </div>

      {isAdmin && (
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Nouvel événement</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateEventForm organizations={organizations} sources={sources} />
          </CardContent>
        </Card>
      )}

      {/* Liste des événements */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-gray-500">
            Aucun événement configuré.
          </div>
        ) : (
          events.map((evt) => {
            const total = evt._count.qrCodes || 0;
            const scanned = evt._count.scans || 0;
            const pct = total > 0 ? Math.min(100, Math.round((scanned / total) * 100)) : 0;
            const isOngoing =
              new Date() >= new Date(evt.startsAt) && new Date() <= new Date(evt.endsAt);

            return (
              <Card key={evt.id} className="border-border/40 shadow-sm flex flex-col justify-between">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        isOngoing && evt.status === "ACTIVE"
                          ? "border-emerald-500 text-emerald-600 bg-emerald-50/50"
                          : "border-gray-300 text-gray-600"
                      }`}
                    >
                      {evt.status !== "ACTIVE" ? evt.status : isOngoing ? "EN COURS" : "PLANIFIÉ"}
                    </Badge>
                    <span className="text-[10px] font-mono text-gray-400">
                      ID: {evt.id.slice(-6)}
                    </span>
                  </div>
                  <CardTitle className="text-base font-bold text-gray-900 dark:text-white leading-snug">
                    {evt.name}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Building className="h-3.5 w-3.5 text-gray-400" />
                    <span>{evt.organization?.name || "ScanHub"}</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-gray-500">
                      <span>Billets émis :</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {total}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-gray-500">
                      <span>Scans effectués :</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {scanned} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-400 space-y-1">
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-300">Du :</span>{" "}
                      {new Date(evt.startsAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600 dark:text-gray-300">Au :</span>{" "}
                      {new Date(evt.endsAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    {isAdmin && <EventStatusActions eventId={evt.id} status={evt.status} />}
                    <Link href={`/scans?eventId=${evt.id}`}>
                      <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                        <QrCode className="h-3.5 w-3.5" />
                        Voir les Scans de cet événement
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
