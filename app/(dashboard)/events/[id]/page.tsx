import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getViewer, scope } from "@/lib/tenant";
import { getPlan, formatLimit } from "@/settings/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateTicketForm, ImportTicketsForm } from "@/components/tickets/TicketForms";
import { TicketRowActions } from "@/components/tickets/TicketRowActions";
import { EventStatusActions } from "@/components/events/EventStatusActions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-600 text-white",
  USED: "bg-blue-600 text-white",
  REVOKED: "bg-red-600 text-white",
  EXPIRED: "bg-amber-600 text-white",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Valide",
  USED: "Utilisé",
  REVOKED: "Révoqué",
  EXPIRED: "Expiré",
  BLOCKED: "Bloqué",
  PENDING: "En attente",
};

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/login");

  const { id } = await params;
  const page = Math.max(parseInt((await searchParams).page || "1", 10) || 1, 1);

  // Le filtre d'espace rend invisible l'événement d'un autre client
  const event = await prisma.event.findFirst({
    where: { id, ...scope.events(viewer) },
    include: { organization: { select: { name: true, plan: true } } },
  });
  if (!event) notFound();

  const [tickets, total, used, validScans] = await Promise.all([
    prisma.qRCode.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        status: true,
        reusable: true,
        metadata: true,
        tokenEnc: true,
        usedAt: true,
      },
    }),
    prisma.qRCode.count({ where: { eventId: event.id } }),
    prisma.qRCode.count({ where: { eventId: event.id, status: "USED" } }),
    prisma.scan.count({ where: { eventId: event.id, result: "VALID" } }),
  ]);

  const plan = getPlan(event.organization.plan);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/events" className="text-xs text-blue-600 hover:underline">
            ← Tous les événements
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {event.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {event.organization.name} · du{" "}
            {event.startsAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}{" "}
            au {event.endsAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <Badge variant="outline">{event.status}</Badge>
          {viewer.isAdmin && <EventStatusActions eventId={event.id} status={event.status} />}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Billets émis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-gray-500">
              sur {formatLimit(plan.maxTicketsPerEvent)} (formule {plan.label})
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Billets utilisés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{used}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Entrées validées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{validScans}</div>
          </CardContent>
        </Card>
      </div>

      {viewer.isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Créer des billets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <CreateTicketForm eventId={event.id} />
            <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
              <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                Importer une liste de participants
              </h3>
              <ImportTicketsForm eventId={event.id} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col gap-3 border-b border-gray-100 py-4 dark:border-gray-800 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-sm font-semibold">
            {total} billet{total !== 1 ? "s" : ""}
          </CardTitle>
          {total > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link href={`/events/${event.id}/print`} target="_blank">
                <Button size="sm">Imprimer les QR codes</Button>
              </Link>
              {viewer.isAdmin && (
                <Link href={`/api/v1/events/${event.id}/tickets?format=csv`} target="_blank">
                  <Button size="sm" variant="outline">
                    Exporter (.CSV)
                  </Button>
                </Link>
              )}
              <Link href={`/scans?eventId=${event.id}`}>
                <Button size="sm" variant="outline">
                  Voir les scans
                </Button>
              </Link>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:bg-gray-900/50">
                  <th className="px-6 py-3">Participant</th>
                  <th className="px-6 py-3">Catégorie</th>
                  <th className="px-6 py-3">Type</th>
                  <th className="px-6 py-3">Statut</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      Aucun billet pour cet événement. Ajoutez-en un ou importez une liste.
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => {
                    const meta = (ticket.metadata as Record<string, string> | null) ?? {};
                    return (
                      <tr key={ticket.id}>
                        <td className="px-6 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {meta.holderName || meta.name || "Participant"}
                          </div>
                          {meta.holderEmail && (
                            <div className="text-xs text-gray-500">{meta.holderEmail}</div>
                          )}
                        </td>
                        <td className="px-6 py-3 text-xs text-gray-600 dark:text-gray-300">
                          {meta.holderRole || meta.role || meta.ticketType || "—"}
                        </td>
                        <td className="px-6 py-3">
                          <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {ticket.type}
                          </span>
                          {ticket.reusable && (
                            <span className="ml-2 text-[11px] text-gray-400">réutilisable</span>
                          )}
                        </td>
                        <td className="px-6 py-3">
                          <Badge className={`text-xs ${STATUS_STYLES[ticket.status] ?? "bg-gray-600 text-white"}`}>
                            {STATUS_LABELS[ticket.status] ?? ticket.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-3">
                          <TicketRowActions
                            eventId={event.id}
                            ticketId={ticket.id}
                            status={ticket.status}
                            hasQr={Boolean(ticket.tokenEnc)}
                            canManage={viewer.isAdmin}
                          />
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={`/events/${event.id}?page=${page - 1}`}>
              <Button size="sm" variant="outline">
                ← Précédent
              </Button>
            </Link>
          )}
          <span className="text-gray-500">
            Page {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/events/${event.id}?page=${page + 1}`}>
              <Button size="sm" variant="outline">
                Suivant →
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
