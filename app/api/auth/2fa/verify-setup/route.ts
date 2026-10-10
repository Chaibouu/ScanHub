/**
 * POST /api/auth/2fa/verify-setup
 *
 * Vérifie le premier code TOTP pour confirmer l'enrollment.
 * Si valide → sauvegarde le secret en base et active isTwoFactorEnabled.
 *
 * Body : { secret: string, code: string }
 * Requiert : Authorization: Bearer <accessToken>
 */

import { NextResponse } from "next/server";
import { authenticator } from "otplib";
import { db } from "@/lib/db";
import { getFullTokenPayload } from "@/lib/tokens";
import { getUserById } from "@/data/user";
import { headers } from "next/headers";
import { audit } from "@/lib/audit";
import { getClientIP } from "@/lib/geo";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const token = headersList.get("Authorization")?.split(" ")[1];

    if (!token) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const payload = getFullTokenPayload(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const { secret, code } = await req.json();

    if (!secret || !code) {
      return NextResponse.json(
        { error: "Secret et code requis" },
        { status: 400 }
      );
    }

    // Vérifier le code TOTP avec le secret fourni (pas encore sauvegardé)
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) {
      await audit({
        userId: payload.userId,
        action: "2FA_FAILURE",
        ipAddress: getClientIP(req),
        status: "FAILURE",
        metadata: { reason: "Code TOTP invalide lors de l'enrollment" },
      });

      return NextResponse.json(
        { error: "Code invalide. Vérifiez votre application d'authentification." },
        { status: 400 }
      );
    }

    const user = await getUserById(payload.userId);
    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Sauvegarder le secret et activer 2FA
    await db.user.update({
      where: { id: payload.userId },
      data: {
        twoFactorSecret: secret,
        isTwoFactorEnabled: true,
      },
    });

    await audit({
      userId: payload.userId,
      action: "2FA_ENABLED",
      ipAddress: getClientIP(req),
      status: "SUCCESS",
    });

    return NextResponse.json({
      message: "Double authentification activée avec succès.",
    });
  } catch (error) {
    console.error("Erreur verify-setup 2FA :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
