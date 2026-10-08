import { getAllUsers } from "@/data/user";
import { getUser } from "@/actions/getUser";
import { ImpersonateButton } from "@/components/admin/ImpersonateButton";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

// Page Server Component — pas de "use client" nécessaire
export default async function AdminUsersPage() {
  // Vérifier que l'utilisateur courant est bien ADMIN
  const result = await getUser();
  const currentUser = result?.user?.user;

  if (
    !currentUser ||
    (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)
  ) {
    redirect("/unauthorized");
  }

  const users = await getAllUsers();

  // Exclure les autres admins de la liste (ne peuvent pas être audités)
  const auditableUsers = users.filter(
    (u) => u.role === UserRole.USER && u.id !== currentUser.id
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Gestion des utilisateurs
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {auditableUsers.length} utilisateur{auditableUsers.length !== 1 ? "s" : ""} —
          le bouton <span className="font-medium text-amber-600">Auditer</span> ouvre
          une session de consultation de 15 minutes.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-boxdark shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Utilisateur
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Email vérifié
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {auditableUsers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-10 text-center text-sm text-gray-400"
                >
                  Aucun utilisateur à afficher.
                </td>
              </tr>
            )}

            {auditableUsers.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {/* Avatar + Nom */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.image}
                        alt={user.name ?? ""}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                        {(user.name ?? user.email ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {(user.name ??
                          [user.firstName, user.lastName].filter(Boolean).join(" ")) ||
                          "—"}
                      </p>
                      <p className="text-xs text-gray-400">{user.id}</p>
                    </div>
                  </div>
                </td>

                {/* Email */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                  {user.email ?? "—"}
                </td>

                {/* Statut actif */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {user.isActive ? "Actif" : "Désactivé"}
                  </span>
                </td>

                {/* Email vérifié */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      user.emailVerified
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {user.emailVerified ? "Vérifié" : "En attente"}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {user.isActive ? (
                    <ImpersonateButton
                      targetUserId={user.id}
                      targetName={
                        (user.name ??
                        [user.firstName, user.lastName].filter(Boolean).join(" ")) ||
                        user.email
                      }
                    />
                  ) : (
                    <span className="text-xs text-gray-400 italic">
                      Compte désactivé
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
