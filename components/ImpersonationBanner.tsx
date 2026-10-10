"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/context/SessionContext";
import { endImpersonation } from "@/actions/impersonate";
import { toast } from "sonner";

/**
 * Bannière d'impersonation admin.
 *
 * Affichée dans le layout dashboard quand isImpersonation === true.
 * Utilise endImpersonation() (Server Action) pour supprimer le cookie
 * httpOnly côté serveur, puis router.refresh() pour restaurer la session admin.
 */
export function ImpersonationBanner() {
  const { isImpersonation, user } = useSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!isImpersonation) return null;

  const handleEnd = () => {
    startTransition(async () => {
      const result = await endImpersonation();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Re-render les Server Components → RootLayout relit les cookies → bannière disparaît
      router.refresh();
    });
  };

  const displayName = user?.name ?? user?.email ?? "utilisateur inconnu";

  return (
    <div className="w-full bg-amber-500 px-4 py-2.5 flex items-center justify-between text-white text-sm font-medium z-50 shrink-0">
      <div className="flex items-center gap-2">
        {/* Icône alerte */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>

        <span>
          Mode audit —{" "}
          <strong>{displayName}</strong>
        </span>

        <span className="opacity-70 text-xs">(session 15 min, non-renouvelable)</span>
      </div>

      <button
        onClick={handleEnd}
        disabled={isPending}
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-md px-3 py-1 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Fermeture...
          </>
        ) : (
          <>
            Terminer la session
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}
