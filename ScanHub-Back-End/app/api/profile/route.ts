import { NextResponse } from "next/server";
import { getFullTokenPayload } from "@/lib/tokens";
import { getUserById } from "@/data/user";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const headersList = await headers();
    const token = headersList.get("Authorization")?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ error: "Token manquant" }, { status: 401 });
    }

    const payload = getFullTokenPayload(token);

    if (!payload?.userId) {
      return NextResponse.json(
        { error: "Token invalide ou expiré" },
        { status: 403 }
      );
    }

    const user = await getUserById(payload.userId);

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // Inclure les métadonnées d'impersonation si présentes dans le token
    return NextResponse.json({
      user,
      ...(payload.isImpersonation && {
        isImpersonation: true,
        impersonatedBy: payload.impersonatedBy,
      }),
    });
  } catch (error) {
    console.error("Erreur lors de la récupération du profil :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
