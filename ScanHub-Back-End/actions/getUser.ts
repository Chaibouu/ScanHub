"use server";

import { getUserInfo, refreshUserToken } from "@/lib/user";
import { cookies } from "next/headers";
import { cache } from "react";

export const getUser = cache(async () => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    const refreshToken = cookieStore.get("refreshToken")?.value;
    const impersonationToken = cookieStore.get("impersonationToken")?.value;

    // ─── Impersonation active ─────────────────────────────────────────────────
    // Si un token d'impersonation est présent, on l'utilise en priorité.
    // La session admin normale reste intacte dans "accessToken".
    if (impersonationToken) {
      try {
        const userData = await getUserInfo(impersonationToken);
        if (!userData.error) {
          return {
            user: userData,
            isImpersonation: true,
          };
        }
        // Token expiré ou invalide → on laisse passer (la bannière disparaîtra)
      } catch (error) {
        console.error("Erreur vérification token d'impersonation:", error);
      }
    }

    // ─── Session normale ──────────────────────────────────────────────────────
    if (!refreshToken) {
      return { error: "Token de rafraîchissement manquant" };
    }

    if (accessToken) {
      try {
        const userData = await getUserInfo(accessToken);
        if (!userData.error) {
          return { user: userData };
        } else {
          return { error: userData.error };
        }
      } catch (error) {
        console.error("Erreur lors de la vérification du token d'accès:", error);
      }
    }

    // Rafraîchir si access token absent ou invalide
    try {
      const { accessToken: newAccessToken, accessTokenExpiresAt } =
        await refreshUserToken(refreshToken);

      const userData = await getUserInfo(newAccessToken);
      if (!userData.error) {
        return {
          user: userData,
          tokenInfo: { accessToken: newAccessToken, expiresAt: accessTokenExpiresAt },
        };
      } else {
        return { error: userData.error };
      }
    } catch (error) {
      console.error("Erreur lors du rafraîchissement du token:", error);
      return { error: "Erreur lors du rafraîchissement" };
    }
  } catch (error) {
    console.error("Erreur générale dans getUser:", error);
    return { error: "Erreur serveur" };
  }
});
