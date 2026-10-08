/**
 * POST /api/auth/2fa/login
 *
 * Deuxième étape du login quand 2FA est activé.
 * Le client envoie le tempToken (reçu à l'étape 1) + le code TOTP.
 *
 * Body : { tempToken: string, code: string, rememberMe?: boolean }
 *
 * Flux :
 *   1. POST /api/auth/login → { requires2FA: true, tempToken }
 *   2. POST /api/auth/2fa/login → { accessToken, refreshToken }  ← ici
 */

import { NextResponse, userAgent } from "next/server";
import crypto from "crypto";
import { authenticator } from "otplib";
import { db } from "@/lib/db";
import { getPurposeTokenPayload, createEncryptedJWT } from "@/lib/tokens";
import { createSession } from "@/data/session";
import { getGeoInfo, getClientIP } from "@/lib/geo";
import { audit } from "@/lib/audit";
import { sendLoginNotificationEmail } from "@/lib/mail";
import appConfig from "@/settings";
import type { NextRequest } from "next/server";

function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { tempToken, code, rememberMe } = await req.json();

    if (!tempToken || !code) {
      return NextResponse.json(
        { error: "tempToken et code requis" },
        { status: 400 }
      );
    }

    // ─── Valider le tempToken ─────────────────────────────────────────────────
    const payload = getPurposeTokenPayload(tempToken, "2fa_challenge");

    if (!payload?.userId) {
      return NextResponse.json(
        { error: "Token de challenge 2FA invalide ou expiré" },
        { status: 401 }
      );
    }

    // ─── Récupérer l'utilisateur et son secret TOTP ───────────────────────────
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        isTwoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user || !user.isActive || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: "Utilisateur introuvable ou 2FA non configuré" },
        { status: 403 }
      );
    }

    // ─── Vérifier le code TOTP ────────────────────────────────────────────────
    const isValid = authenticator.verify({
      token: code,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      await audit({
        userId: user.id,
        action: "2FA_FAILURE",
        ipAddress: getClientIP(req),
        status: "FAILURE",
        metadata: { email: user.email },
      });

      return NextResponse.json(
        { error: "Code invalide. Vérifiez votre application d'authentification." },
        { status: 401 }
      );
    }

    // ─── Créer la session complète ────────────────────────────────────────────
    if (!appConfig.allowMultipleSessions) {
      await db.session.deleteMany({ where: { userId: user.id } });
    }

    const accessToken = createEncryptedJWT({ userId: user.id, email: user.email }, "1h");
    const rawRefreshToken = crypto.randomBytes(64).toString("hex");

    await createSession({
      userId: user.id,
      sessionToken: accessToken,
      refreshToken: hashRefreshToken(rawRefreshToken),
      expires: new Date(Date.now() + 60 * 60 * 1000),
      refreshTokenExpires: rememberMe
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastActivity: new Date(),
      isImpersonation: false,
      impersonatedBy: null,
    });

    // ─── Device + géoloc ─────────────────────────────────────────────────────
    const { device, browser, os } = userAgent(req);
    const ipAddress = getClientIP(req);
    const geoInfo = await getGeoInfo(req);

    await db.userDevice.create({
      data: {
        userId: user.id,
        device: `${device.vendor ?? "Inconnu"} ${device.model ?? "Inconnu"}`,
        os: `${os.name ?? "Inconnu"} ${os.version ?? ""}`,
        browser: `${browser.name ?? "Inconnu"} ${browser.version ?? ""}`,
        ipAddress,
        latitude: geoInfo?.latitude ?? null,
        longitude: geoInfo?.longitude ?? null,
        city: geoInfo?.city ?? "Ville inconnue",
        country: geoInfo?.country ?? "Pays inconnu",
      },
    });

    // ─── Audit + notification ─────────────────────────────────────────────────
    await audit({
      userId: user.id,
      action: "2FA_SUCCESS",
      ipAddress,
      status: "SUCCESS",
      metadata: { email: user.email },
    });

    // Notification email si nouvelle IP
    const knownDevices = await db.userDevice.findMany({
      where: { userId: user.id, ipAddress },
    });
    if (knownDevices.length <= 1) {
      sendLoginNotificationEmail(user.email as string, {
        device: `${device.vendor ?? ""} ${device.model ?? ""}`.trim() || "Inconnu",
        browser: `${browser.name ?? ""} ${browser.version ?? ""}`.trim() || "Inconnu",
        os: `${os.name ?? ""} ${os.version ?? ""}`.trim() || "Inconnu",
        ip: ipAddress,
        city: geoInfo?.city ?? "Inconnue",
        country: geoInfo?.country ?? "Inconnu",
        time: new Date().toLocaleString("fr-FR", { timeZone: "UTC" }),
      }).catch(() => {}); // Non-bloquant
    }

    return NextResponse.json({
      message: "Connexion réussie",
      accessToken,
      refreshToken: rawRefreshToken,
    });
  } catch (error) {
    console.error("Erreur 2FA login :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
