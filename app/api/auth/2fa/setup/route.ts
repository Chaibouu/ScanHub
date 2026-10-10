/**
 * GET /api/auth/2fa/setup
 *
 * Génère un secret TOTP et retourne le QR code + secret base32.
 * Le secret N'EST PAS encore sauvegardé — il le sera seulement après
 * que l'utilisateur ait validé son premier code (verify-setup).
 *
 * Requiert : Authorization: Bearer <accessToken>
 */

import { NextResponse } from "next/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { getFullTokenPayload } from "@/lib/tokens";
import { getUserById } from "@/data/user";
import { headers } from "next/headers";
import appConfig from "@/settings";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const user = await getUserById(payload.userId);
    if (!user || !user.email) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Générer un nouveau secret TOTP (base32, 20 octets)
    const secret = authenticator.generateSecret(20);

    // URI otpauth:// standard — compatible Google Authenticator, Authy, Bitwarden…
    const otpauthUrl = authenticator.keyuri(
      user.email,
      appConfig.appName,
      secret
    );

    // Générer le QR code en data URL (PNG base64)
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: "M",
      width: 256,
    });

    return NextResponse.json({
      secret,        // À afficher comme backup si le QR ne peut pas être scanné
      otpauthUrl,    // URI otpauth:// brut
      qrCodeDataUrl, // Image PNG base64 à afficher directement : <img src={qrCodeDataUrl} />
    });
  } catch (error) {
    console.error("Erreur setup 2FA :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
