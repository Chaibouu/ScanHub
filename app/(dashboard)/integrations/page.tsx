import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getViewer, scope } from "@/lib/tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code } from "lucide-react";
import { RotateApiKeyButton } from "@/components/integrations/RotateApiKeyButton";
import { CreateSourceForm } from "@/components/integrations/CreatePartnerForms";

export const dynamic = "force-dynamic";

const API_ENDPOINTS = [
  { method: "GET", path: "/events", text: "Vos événements (pour obtenir un eventId)" },
  { method: "POST", path: "/events", text: "Créer un événement" },
  { method: "POST", path: "/qrs", text: "Créer un QR code (billet, badge, invitation…)" },
  { method: "POST", path: "/qrs/batch", text: "Créer jusqu'à 500 QR codes en un appel" },
  { method: "GET", path: "/qrs/:id", text: "Détail d'un code (par identifiant ou par votre référence)" },
  { method: "GET", path: "/qrs/:id/image", text: "Image du QR code (PNG ou SVG)" },
  { method: "POST", path: "/qrs/:id/revoke", text: "Révoquer un code" },
  { method: "POST", path: "/qrs/:id/restore", text: "Rétablir un code révoqué" },
  { method: "POST", path: "/verify", text: "Vérifier un code sans le consommer" },
  { method: "POST", path: "/consume", text: "Valider un passage (scan depuis votre application)" },
  { method: "GET", path: "/scans", text: "Lire les scans / présences, de façon incrémentale" },
];

export default async function IntegrationsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/login");
  if (!viewer.isAdmin) redirect("/unauthorized");

  const [sources, organizations] = await Promise.all([
    prisma.source.findMany({
      // La source interne « création manuelle » n'est pas une billetterie connectée par API
      where: { ...scope.sources(viewer), NOT: { slug: { endsWith: "--scanhub" } } },
      orderBy: { createdAt: "desc" },
      include: {
        organization: true,
        _count: {
          select: { qrCodes: true, events: true },
        },
      },
    }),
    prisma.organization.findMany({
      where: scope.organizations(viewer),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Intégrations & Partenaires API
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Connexion des billetteries externes (EventHub, JNJL, plateformes tierces) à ScanHub.
          </p>
        </div>
      </div>

      <Card className="border-border/40 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Connecter une billetterie externe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-gray-500">
            Une billetterie connectée envoie automatiquement ses billets vendus à ScanHub grâce à
            une clé API. Pour créer vos billets vous-même, utilisez la page d'un événement.
          </p>
          <CreateSourceForm organizations={organizations} />
        </CardContent>
      </Card>

      {/* Sources existantes */}
      <div className="grid gap-6 md:grid-cols-2">
        {sources.length === 0 ? (
          <div className="col-span-full py-12 text-center text-sm text-gray-500">
            Aucune billetterie connectée.
          </div>
        ) : (
          sources.map((src) => {
            return (
              <Card key={src.id} className="border-border/40 shadow-sm">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs uppercase font-mono">
                      {src.slug}
                    </Badge>
                    {src.apiKeyHash ? (
                      <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                        API ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20">
                        AUCUNE CLÉ
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-lg font-bold text-gray-900 dark:text-white">
                    {src.name}
                  </CardTitle>
                  <p className="text-xs text-gray-500">
                    Organisation : {src.organization?.name || "ScanHub"}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-2 gap-3 text-xs p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800">
                    <div>
                      <span className="text-gray-400 block text-[11px]">QR Codes injectés</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {src._count.qrCodes}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[11px]">Événements liés</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {src._count.events}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <span className="text-gray-400 font-mono text-[11px]">En-tête d'authentification requis :</span>
                    <div className="p-2 bg-gray-900 text-emerald-400 font-mono text-[11px] rounded flex items-center justify-between">
                      <span>x-api-key: ••••••••••••••••</span>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      La clé n'est stockée que sous forme de hash : elle n'est visible qu'au moment
                      de sa génération.
                    </p>
                  </div>

                  <RotateApiKeyButton sourceId={src.id} hasKey={Boolean(src.apiKeyHash)} />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Aide-mémoire de l'API développeur */}
      <Card className="border-border/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Code className="h-4 w-4 text-blue-600" />
            API développeur — créer et vérifier vos QR codes depuis votre plateforme
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <p className="text-gray-500">
            Toutes les requêtes portent l'en-tête <code>x-api-key</code> avec votre clé. Adresse de
            base : <code>/api/v1/integrations</code>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {API_ENDPOINTS.map((endpoint) => (
                  <tr key={endpoint.method + endpoint.path}>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold text-white ${
                          endpoint.method === "GET" ? "bg-emerald-600" : "bg-blue-600"
                        }`}
                      >
                        {endpoint.method}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-gray-800 dark:text-gray-200">
                      {endpoint.path}
                    </td>
                    <td className="py-2 text-gray-500">{endpoint.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-500">
            Envoyez votre propre référence dans <code>externalId</code> (numéro de badge, de
            commande…) : si vous renvoyez la même création, ScanHub rend le même code au lieu d'en
            créer un second.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
