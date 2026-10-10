import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import prisma from "@/lib/prisma";
import { getViewer, scope } from "@/lib/tenant";
import { ticketService } from "@/modules/tickets/ticketService";
import { PrintButton } from "@/components/tickets/PrintButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

/**
 * Planche de QR codes à imprimer (hors mise en page du tableau de bord).
 * ?ticket=<id> n'affiche qu'un billet ; ?page=<n> parcourt les planches suivantes.
 */
export default async function PrintTicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ticket?: string; page?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/login");

  const { id } = await params;
  const query = await searchParams;
  const page = Math.max(parseInt(query.page || "1", 10) || 1, 1);

  const event = await prisma.event.findFirst({
    where: { id, ...scope.events(viewer) },
    select: { id: true, name: true, startsAt: true },
  });
  if (!event) notFound();

  const total = await prisma.qRCode.count({ where: { eventId: event.id } });
  const tickets = await ticketService.listWithTokens(event.id, {
    ticketId: query.ticket,
    skip: query.ticket ? undefined : (page - 1) * PAGE_SIZE,
    take: query.ticket ? undefined : PAGE_SIZE,
  });

  // Seuls les billets créés dans ScanHub ont un QR ré-affichable
  const printable = await Promise.all(
    tickets
      .filter((ticket) => ticket.token)
      .map(async (ticket) => ({
        ...ticket,
        qr: await QRCode.toDataURL(ticket.token as string, { margin: 1, width: 240 }),
      }))
  );
  const skipped = tickets.length - printable.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-5xl bg-white p-6 text-gray-900">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-bold">{event.name}</h1>
          <p className="text-sm text-gray-500">
            {printable.length} QR code{printable.length !== 1 ? "s" : ""} sur cette planche
            {!query.ticket && totalPages > 1 ? ` — planche ${page} / ${totalPages}` : ""}
            {skipped > 0
              ? ` · ${skipped} billet(s) provenant d'une billetterie externe non affiché(s)`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {!query.ticket && page > 1 && (
            <a className="rounded border px-3 py-2 text-sm" href={`?page=${page - 1}`}>
              ← Planche précédente
            </a>
          )}
          {!query.ticket && page < totalPages && (
            <a className="rounded border px-3 py-2 text-sm" href={`?page=${page + 1}`}>
              Planche suivante →
            </a>
          )}
          <PrintButton />
        </div>
      </div>

      {printable.length === 0 ? (
        <p className="py-12 text-center text-gray-500">Aucun QR code à imprimer.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 print:grid-cols-3">
          {printable.map((ticket) => (
            <div
              key={ticket.id}
              className="flex break-inside-avoid flex-col items-center rounded-lg border border-gray-300 p-4 text-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ticket.qr} alt={`QR code de ${ticket.holderName}`} width={180} height={180} />
              <p className="mt-2 text-sm font-semibold">{ticket.holderName}</p>
              {ticket.holderRole && <p className="text-xs text-gray-600">{ticket.holderRole}</p>}
              <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">
                {ticket.type} · {event.name}
              </p>
              {ticket.status === "REVOKED" && (
                <p className="mt-1 text-xs font-bold text-red-600">RÉVOQUÉ</p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
