import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { createEncryptedJWT } from "@/lib/tokens";

/**
 * Hache le refresh token avec SHA-256 pour retrouver son équivalent en base.
 * Doit être identique à la fonction utilisée lors de la création de session (login).
 */
function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Token de rafraîchissement manquant" },
        { status: 400 }
      );
    }

    // ✅ On cherche le HASH du token en base — pas le token brut
    const hashedToken = hashRefreshToken(refreshToken);

    const session = await db.session.findUnique({
      where: { refreshToken: hashedToken },
    });

    if (!session || new Date() > session.refreshTokenExpires) {
      return NextResponse.json(
        { error: "Token de rafraîchissement expiré ou introuvable" },
        { status: 403 }
      );
    }

    // Générer un nouveau token d'accès
    const payload = { userId: session.userId };
    const newAccessToken = createEncryptedJWT(payload, "1h"); // 1h cohérent avec le login

    const accessTokenExpiresAt = 60 * 60; // en secondes

    await db.session.update({
      where: { id: session.id },
      data: {
        sessionToken: newAccessToken,
        expires: new Date(Date.now() + accessTokenExpiresAt * 1000),
        lastActivity: new Date(),
      },
    });

    return NextResponse.json({
      accessToken: newAccessToken,
      accessTokenExpiresAt,
    });

  } catch (error) {
    console.error("Erreur lors du rafraîchissement des tokens :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
