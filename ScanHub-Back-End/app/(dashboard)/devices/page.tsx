import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Key } from "lucide-react";
import { CreateDeviceForm } from "@/components/devices/CreateDeviceForm";
import { DeviceRowActions } from "@/components/devices/DeviceRowActions";

export const dynamic = "force-dynamic";

export default async function DevicesPage() {
  const [devices, agents] = await Promise.all([
    prisma.device.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        role: { in: ["AGENT", "ADMIN", "SUPER_ADMIN"] },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Terminaux Mobiles & Scanners
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gestion du parc de téléphones et lecteurs QR autorisés aux portes d'accès.
          </p>
        </div>
      </div>

      {/* Guide d'activation rapide */}
      <Card className="border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">
            <Key className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
              Procédure d'activation sur smartphone mobile
            </h4>
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              Créez le terminal ci-dessous : un code d'activation à usage unique (valable 48 h)
              est généré. L'agent le saisit dans l'application mobile ScanHub, qui reçoit alors
              une clé propre à l'appareil pour identifier chaque scan.
            </p>
            <div className="pt-3">
              <CreateDeviceForm
                agents={agents.map((a) => ({
                  id: a.id,
                  label: `${a.name || a.email || "Sans nom"} (${a.role})`,
                }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des terminaux */}
      <Card className="border-border/40 shadow-sm overflow-hidden">
        <CardHeader className="py-4 px-6 border-b border-gray-100 dark:border-gray-800">
          <CardTitle className="text-sm font-semibold">
            {devices.length} terminaux enregistrés
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                  <th className="py-3 px-6">Terminal</th>
                  <th className="py-3 px-6">Statut</th>
                  <th className="py-3 px-6">Agent Associé</th>
                  <th className="py-3 px-6">Dernière Connexion</th>
                  <th className="py-3 px-6">Date de Création</th>
                  <th className="py-3 px-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {devices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      Aucun terminal mobile enregistré pour le moment.
                    </td>
                  </tr>
                ) : (
                  devices.map((device) => {
                    return (
                      <tr
                        key={device.id}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors"
                      >
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300">
                              <Smartphone className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {device.name}
                              </div>
                              <div className="text-[11px] text-gray-400 font-mono">
                                ID: {device.id.slice(0, 12)}…
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-6">
                          <Badge
                            className={`text-xs px-2.5 py-0.5 font-semibold ${
                              device.active
                                ? "bg-emerald-600 text-white"
                                : "bg-red-600 text-white"
                            }`}
                          >
                            {device.active ? "ACTIF" : "BLOQUÉ"}
                          </Badge>
                          {!device.activatedAt && (
                            <div className="mt-1 text-[11px] text-amber-600">
                              En attente d'activation
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-6 text-xs">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {device.user?.name || "Agent non assigné"}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {device.user?.email || "—"}
                          </div>
                        </td>
                        <td className="py-3 px-6 text-xs text-gray-500">
                          {device.lastSeenAt
                            ? new Date(device.lastSeenAt).toLocaleString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Jamais connecté"}
                        </td>
                        <td className="py-3 px-6 text-xs text-gray-500">
                          {new Date(device.createdAt).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-6">
                          <DeviceRowActions deviceId={device.id} active={device.active} />
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
