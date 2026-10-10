import { NextResponse, userAgent } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getUserByEmail } from "@/data/user";
import { createEncryptedJWT, generateVerificationToken } from "@/lib/tokens";
import { createSession } from "@/data/session";
import appConfig from "@/settings";
import { sendVerificationEmail, sendLoginNotificationEmail } from "@/lib/mail";
import { getGeoInfo, getClientIP } from "@/lib/geo";
import {
  getBackoffDelay,
  getFailedAttempts,
  incrementFailedAttempt,
  resetFailedAttempts,
} from "@/lib/backoff";
import { LoginSchema } from "@/schemas";
import { audit } from "@/lib/audit";
import { checkPasswordPwned } from "@/lib/hibp";
import { rateLimitRedisAuth } from "@/lib/rateLimitRedis";
import type { NextRequest } from "next/server";

function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    // ─── Rate limiting Redis (couche 2 — persistant multi-instance) ──────────
    const ip = getClientIP(req);
    const rlResponse = await rateLimitRedisAuth(ip);
    if (rlResponse) return rlResponse;

    const { email, password, rememberMe } = await req.json();

    if (!email) return NextResponse.json({ error: "L'email est requis" }, { status: 400 });
    if (!password) return NextResponse.json({ error: "Le mot de passe est requis" }, { status: 400 });

    const parsedData = LoginSchema.safeParse({ email, password });
    if (!parsedData.success) {
      return NextResponse.json(
        { error: parsedData.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const user = await getUserByEmail(email);

    if (!user) {
      await audit({ action: "LOGIN_FAILURE", ipAddress: ip, status: "FAILURE", metadata: { email, reason: "Email introuvable" } });
      return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }

    if (!user.emailVerified) {
      const verificationToken = await generateVerificationToken(user.email as string);
      await sendVerificationEmail(user.email as string, verificationToken);
      return NextResponse.json(
        { error: "Veuillez vérifier votre email. Un nouvel email de vérification a été envoyé." },
        { status: 403 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Votre compte est désactivé. Contactez l'administrateur." },
        { status: 403 }
      );
    }

    if (user.organizationId) {
      const organization = await db.organization.findUnique({
        where: { id: user.organizationId },
        select: { isActive: true },
      });
      if (organization && !organization.isActive) {
        return NextResponse.json(
          { error: "Cet espace ScanHub est suspendu. Contactez le support." },
          { status: 403 }
        );
      }
    }

    // ─── Backoff progressif ───────────────────────────────────────────────────
    const failedAttempts = await getFailedAttempts(user.id);
    if (failedAttempts >= appConfig.backoff.maxAttempts) {
      const delay = getBackoffDelay(failedAttempts);
      const lastFailed = await db.failedLoginAttempt.findFirst({
        where: { userId: user.id },
        orderBy: { attemptAt: "desc" },
      });
      const elapsed = lastFailed?.attemptAt ? Date.now() - new Date(lastFailed.attemptAt).getTime() : 0;
      const remaining = delay - elapsed;
      if (remaining > 0) {
        return NextResponse.json(
          { error: `Trop de tentatives. Réessayez dans ${Math.ceil(remaining / 60000)} minute(s).` },
          { status: 429 }
        );
      }
    }

    // ─── Vérification du mot de passe ─────────────────────────────────────────
    const isPasswordValid = await bcrypt.compare(password, user.password as string);

    if (!isPasswordValid) {
      await incrementFailedAttempt(user.id);
      await audit({ userId: user.id, action: "LOGIN_FAILURE", ipAddress: ip, status: "FAILURE", metadata: { reason: "Mot de passe incorrect" } });
      return NextResponse.json({ error: "Email ou mot de passe incorrect" }, { status: 401 });
    }

    await resetFailedAttempts(user.id);

    // ─── 2FA TOTP requis ? ────────────────────────────────────────────────────
    if (user.isTwoFactorEnabled) {
      // Retourner un challenge token court (5 min) — pas encore de session
      const tempToken = createEncryptedJWT(
        { userId: user.id, purpose: "2fa_challenge" },
        "5m"
      );
      return NextResponse.json({ requires2FA: true, tempToken }, { status: 200 });
    }

    // ─── Pas de 2FA — créer la session directement ────────────────────────────
    if (!appConfig.allowMultipleSessions) {
      // Une seule session web à la fois ; les terminaux mobiles (canal "api") restent connectés
      await db.session.deleteMany({ where: { userId: user.id, channel: "web" } });
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
      channel: "web",
    });

    // ─── Device + géoloc ──────────────────────────────────────────────────────
    const { device, browser, os } = userAgent(req);
    const geoInfo = await getGeoInfo(req);

    const deviceRecord = await db.userDevice.create({
      data: {
        userId: user.id,
        device: `${device.vendor ?? "Inconnu"} ${device.model ?? "Inconnu"}`,
        os: `${os.name ?? "Inconnu"} ${os.version ?? ""}`,
        browser: `${browser.name ?? "Inconnu"} ${browser.version ?? ""}`,
        ipAddress: ip,
        latitude: geoInfo?.latitude ?? null,
        longitude: geoInfo?.longitude ?? null,
        city: geoInfo?.city ?? "Ville inconnue",
        country: geoInfo?.country ?? "Pays inconnu",
      },
    });

    // ─── Audit ────────────────────────────────────────────────────────────────
    await audit({
      userId: user.id,
      action: "LOGIN_SUCCESS",
      ipAddress: ip,
      status: "SUCCESS",
      metadata: { email: user.email, deviceId: deviceRecord.id },
    });

    // ─── Notification email si nouvelle IP ───────────────────────────────────
    const existingDevicesWithIp = await db.userDevice.count({
      where: { userId: user.id, ipAddress: ip },
    });

    if (existingDevicesWithIp <= 1) {
      sendLoginNotificationEmail(user.email as string, {
        device: `${device.vendor ?? ""} ${device.model ?? ""}`.trim() || "Inconnu",
        browser: `${browser.name ?? ""} ${browser.version ?? ""}`.trim() || "Inconnu",
        os: `${os.name ?? ""} ${os.version ?? ""}`.trim() || "Inconnu",
        ip,
        city: geoInfo?.city ?? "Inconnue",
        country: geoInfo?.country ?? "Inconnu",
        time: new Date().toLocaleString("fr-FR", { timeZone: "UTC" }),
      }).catch(() => {}); // Non-bloquant, ne pas rater le login si l'email échoue
    }

    return NextResponse.json({
      message: "Connexion réussie",
      accessToken,
      refreshToken: rawRefreshToken,
    });
  } catch (error) {
    console.error("Erreur lors de la connexion :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
