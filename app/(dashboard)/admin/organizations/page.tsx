import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getViewer } from "@/lib/tenant";
import { PLANS, getPlan } from "@/settings/plans";
import {
  CreateOrganizationForm,
  OrganizationRowActions,
} from "@/components/admin/OrganizationForms";

export const dynamic = "force-dynamic";

/**
 * Console du propriétaire de la plateforme : tous les espaces clients, leur usage,
 * leur formule, et la possibilité de les suspendre.
 */
export default async function OrganizationsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/login");
  if (!viewer.isSuperAdmin) redirect("/unauthorized");

  const [organizations, ticketCounts, scanCounts] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, events: true } } },
    }),
    // Billets et scans par espace, en deux requêtes agrégées
    prisma.$queryRaw<{ organizationId: string; total: bigint }[]>`
      SELECT s."organizationId", COUNT(q."id") AS total
      FROM "qr_codes" q JOIN "sources" s ON s."id" = q."sourceId"
      GROUP BY s."organizationId"`,
    prisma.$queryRaw<{ organizationId: string; total: bigint }[]>`
      SELECT sc."organizationId", COUNT(sc."id") AS total
      FROM "scans" sc
      WHERE sc."organizationId" IS NOT NULL
      GROUP BY sc."organizationId"`,
  ]);

  const ticketsByOrg = new Map(ticketCounts.map((r) => [r.organizationId, Number(r.total)]));
  const scansByOrg = new Map(scanCounts.map((r) => [r.organizationId, Number(r.total)]));
  const plans = Object.entries(PLANS).map(([value, plan]) => ({ value, label: plan.label }));
  const activeCount = organizations.filter((o) => o.isActive).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Espaces clients</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {organizations.length} espace{organizations.length !== 1 ? "s" : ""}, dont {activeCount}{" "}
          actif{activeCount !== 1 ? "s" : ""}. Chaque espace est cloisonné : ses membres ne voient
          que leurs propres données.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-boxdark">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Ouvrir un espace pour un client
        </h2>
        <p className="text-xs text-gray-500">
          Les organisateurs peuvent aussi créer leur espace eux-mêmes depuis la page d'inscription.
        </p>
        <CreateOrganizationForm />
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-boxdark">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {["Espace", "Membres", "Événements", "Billets", "Scans", "Statut"].map((title) => (
                <th
                  key={title}
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  {title}
                </th>
              ))}
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Formule & actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {organizations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">
                  Aucun espace client pour le moment.
                </td>
              </tr>
            )}
            {organizations.map((org) => (
              <tr key={org.id} className="align-top">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{org.name}</p>
                  <p className="text-xs text-gray-400">
                    créé le{" "}
                    {org.createdAt.toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · formule {getPlan(org.plan).label}
                  </p>
                </td>
                <td className="px-6 py-4 text-sm">{org._count.users}</td>
                <td className="px-6 py-4 text-sm">{org._count.events}</td>
                <td className="px-6 py-4 text-sm">{ticketsByOrg.get(org.id) ?? 0}</td>
                <td className="px-6 py-4 text-sm">{scansByOrg.get(org.id) ?? 0}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      org.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {org.isActive ? "Actif" : "Suspendu"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <OrganizationRowActions
                    organizationId={org.id}
                    isActive={org.isActive}
                    plan={org.plan}
                    plans={plans}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
