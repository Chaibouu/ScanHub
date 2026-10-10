import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getFullTokenPayload } from "@/lib/tokens";
import type { NextRequest } from "next/server";

export async function DELETE(req: NextRequest) {
  try {
    // ─── 1. Lire le token d'impersonation ─────────────────────────────────────
    // Le client envoie le token d'impersonation dans l'Authorization header
    const authHeader = req.headers.get("Authorization");
    const impersonationToken = authHeader?.split(" ")[1];

    if (!impersonationToken) {
      return NextResponse.json(
        { error: "Token d'impersonation manquant" },
        { status: 400 }
      );
    }

    // ─── 2. Vérifier que c'est bien un token d'impersonation ─────────────────
    const payload = getFullTokenPayload(impersonationToken);

    if (!payload?.isImpersonation) {
      return NextResponse.json(
        { error: "Token invalide ou non-impersonation" },
        { status: 400 }
      );
    }

    // ─── 3. Supprimer la session d'impersonation en base ─────────────────────
    await db.session.deleteMany({
      where: {
        sessionToken: impersonationToken,
        isImpersonation: true,
      },
    });

    // ─── 4. Réponse avec suppression du cookie ────────────────────────────────
    const response = NextResponse.json({ message: "Session d'impersonation terminée" });

    // Supprimer le cookie côté serveur
    response.cookies.set({
      name: "impersonationToken",
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
      path: "/",
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error("Erreur lors de la fin d'impersonation :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
