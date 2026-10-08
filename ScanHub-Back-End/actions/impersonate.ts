"use server";

import { cookies } from "next/headers";

// ─── Démarrer une session d'impersonation ─────────────────────────────────────

export async function startImpersonation(targetUserId: string) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("accessToken")?.value;

  if (!accessToken) {
    return { error: "Non authentifié" };
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/impersonate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ targetUserId }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    return { error: result.error ?? "Impossible de démarrer l'audit" };
  }

  // Poser le cookie httpOnly côté serveur — impossible avec document.cookie en Next.js 15
  cookieStore.set("impersonationToken", result.impersonationToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 15 * 60, // 15 minutes, cohérent avec l'expiration du JWT
    path: "/",
    sameSite: "lax",
  });

  return {
    success: true,
    targetUser: result.targetUser as {
      id: string;
      name: string | null;
      email: string | null;
      role: string;
    },
  };
}

// ─── Terminer une session d'impersonation ─────────────────────────────────────

export async function endImpersonation() {
  const cookieStore = await cookies();
  const impersonationToken = cookieStore.get("impersonationToken")?.value;

  if (!impersonationToken) {
    return { error: "Aucune session d'audit active" };
  }

  // Supprimer la session en base de données
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/impersonate/end`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${impersonationToken}` },
  });

  // Supprimer le cookie côté serveur
  cookieStore.delete("impersonationToken");

  return { success: true };
}
