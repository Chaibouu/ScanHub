import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refreshUserToken } from "@/lib/user";
import { getUserIdFromToken } from "@/lib/tokens";

// Types pour les réponses d'authentification
export interface AuthResult {
  success: boolean;
  accessToken?: string;
  error?: string;
}

export interface AuthenticatedUser {
  accessToken: string;
  userId: string;
}

// Fonction pour récupérer l'utilisateur authentifié
export async function getAuthenticatedUser(): Promise<AuthenticatedUser> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;
  const refreshToken = cookieStore.get("refreshToken")?.value;

  if (!refreshToken) {
    redirect("/auth/login");
  }

  // Si pas d'accessToken, essayer de le rafraîchir
  if (!accessToken) {
    try {
      const { accessToken: newAccessToken, accessTokenExpiresAt } =
        await refreshUserToken(refreshToken);

      cookieStore.set("accessToken", newAccessToken, {
        httpOnly: true,
        secure: true,
        maxAge: accessTokenExpiresAt,
        path: "/",
        sameSite: "lax",
      });

      // Extraire l'userId du token en utilisant getUserIdFromToken
      const userId = await getUserIdFromToken(newAccessToken);
      if (!userId) {
        throw new Error("Token invalide");
      }

      return { accessToken: newAccessToken, userId };
    } catch (error) {
      redirect("/auth/login");
    }
  }

  // Extraire l'userId du token existant
  const userId = await getUserIdFromToken(accessToken);
  if (!userId) {
    redirect("/auth/login");
  }

  return { accessToken, userId };
}

// Fonction pour vérifier si l'utilisateur est authentifié (sans redirection)
export async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    const refreshToken = cookieStore.get("refreshToken")?.value;

    if (!refreshToken) {
      return false;
    }

    if (!accessToken) {
      // Essayer de rafraîchir le token
      try {
        const { accessToken: newAccessToken, accessTokenExpiresAt } =
          await refreshUserToken(refreshToken);

        cookieStore.set("accessToken", newAccessToken, {
          httpOnly: true,
          secure: true,
          maxAge: accessTokenExpiresAt,
          path: "/",
          sameSite: "lax",
        });

        return true;
      } catch (error) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}

// Fonction pour faire un appel API authentifié
export async function authenticatedApiCall<T = any>(
  endpoint: string,
  method: string,
  body?: any
): Promise<T> {
  const { accessToken } = await getAuthenticatedUser();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}${endpoint}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erreur API");
  }

  return response.json();
}

// Fonction pour déconnecter l'utilisateur
export async function logoutUser(): Promise<void> {
  const cookieStore = await cookies();

  // Supprimer les cookies d'authentification
  cookieStore.delete("accessToken");
  cookieStore.delete("refreshToken");

  redirect("/auth/login");
}

// Fonction pour valider les permissions
export async function requirePermission(permission: string): Promise<void> {
  const { accessToken } = await getAuthenticatedUser();

  // Vérifiez les permissions dans votre token ou base de données
  // Exemple basique
  const payload = JSON.parse(atob(accessToken.split(".")[1]));
  const userPermissions = payload.permissions || [];

  if (!userPermissions.includes(permission)) {
    redirect("/unauthorized");
  }
}
