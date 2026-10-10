import { getAllUsers } from "@/data/user";
import { getUser } from "@/actions/getUser";
import { ImpersonateButton } from "@/components/admin/ImpersonateButton";
import { CreateUserForm } from "@/components/admin/CreateUserForm";
import { UserRowActions } from "@/components/admin/UserRowActions";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  ADMIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  AGENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  USER: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

// Page Server Component — pas de "use client" nécessaire
export default async function AdminUsersPage() {
  const result = await getUser();
  const currentUser = result?.user?.user;

  if (
    !currentUser ||
    (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)
  ) {
    redirect("/unauthorized");
  }

  const users = await getAllUsers();
  const isSuperAdmin = currentUser.role === UserRole.SUPER_ADMIN;

  // Même hiérarchie que côté serveur (actions/scanhub-admin.ts) : un ADMIN gère AGENT et USER,
  // un SUPER_ADMIN gère aussi les ADMIN. Personne ne se modifie soi-même ici.
  const assignableRoles = isSuperAdmin ? ["ADMIN", "AGENT", "USER"] : ["AGENT", "USER"];
  const canManage = (user: { id: string; role: UserRole }) =>
    user.id !== currentUser.id &&
    user.role !== UserRole.SUPER_ADMIN &&
    (user.role !== UserRole.ADMIN || isSuperAdmin);
  const isAdminAccount = (role: UserRole) =>
    role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;

  const displayName = (user: (typeof users)[number]) =>
    (user.name ?? [user.firstName, user.lastName].filter(Boolean).join(" ")) || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Gestion des utilisateurs
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {users.length} compte{users.length !== 1 ? "s" : ""} — le bouton{" "}
          <span className="font-medium text-amber-600">Auditer</span> ouvre une session de
          consultation de 15 minutes.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-boxdark shadow-sm p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Nouveau compte</h2>
        <CreateUserForm allowedRoles={isSuperAdmin ? ["AGENT", "USER", "ADMIN"] : ["AGENT", "USER"]} />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto bg-white dark:bg-boxdark shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {["Utilisateur", "Email", "Rôle", "Statut"].map((title) => (
                <th
                  key={title}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  {title}
                </th>
              ))}
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                  Aucun utilisateur à afficher.
                </td>
              </tr>
            )}

            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors align-top"
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
                        {displayName(user) || "—"}
                        {user.id === currentUser.id && (
                          <span className="ml-2 text-xs font-normal text-gray-400">(vous)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {user.emailVerified ? "Email vérifié" : "Email non vérifié"}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                  {user.email ?? "—"}
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_STYLES[user.role] ?? ROLE_STYLES.USER}`}
                  >
                    {user.role}
                  </span>
                </td>

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

                <td className="px-6 py-4 text-right">
                  <div className="flex flex-col items-end gap-2">
                    {canManage(user) ? (
                      <UserRowActions
                        userId={user.id}
                        role={user.role}
                        isActive={user.isActive}
                        assignableRoles={assignableRoles}
                      />
                    ) : (
                      <span className="text-xs text-gray-400 italic">
                        {user.id === currentUser.id ? "Votre compte" : "Compte protégé"}
                      </span>
                    )}
                    {user.isActive && !isAdminAccount(user.role) && (
                      <ImpersonateButton
                        targetUserId={user.id}
                        targetName={displayName(user) || user.email}
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
