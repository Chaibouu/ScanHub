import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getFullTokenPayload, createEncryptedJWT } from "@/lib/tokens";
import { getUserById } from "@/data/user";
import type { NextRequest } from "next/server";

const ADMIN_ROLES: string[] = ["ADMIN", "SUPER_ADMIN"];

// Durée d'une session d'impersonation : 15 minutes, non-renouvelable
const IMPERSONATION_DURATION_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    // ─── 1. Authentifier l'admin ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const adminToken = authHeader?.split(" ")[1];

    if (!adminToken) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      );
    }

    // Une session d'audit ne peut pas en ouvrir une autre
    const adminPayload = getFullTokenPayload(adminToken);
    if (!adminPayload?.userId || adminPayload.isImpersonation) {
      return NextResponse.json(
        { error: "Token administrateur invalide ou expiré" },
        { status: 401 }
      );
    }

    // ─── 2. Vérifier le rôle ADMIN ────────────────────────────────────────────
    const adminSession = await db.session.findUnique({
      where: { sessionToken: adminToken },
      select: { userId: true, expires: true },
    });
    if (
      !adminSession ||
      adminSession.userId !== adminPayload.userId ||
      adminSession.expires < new Date()
    ) {
      return NextResponse.json(
        { error: "Session administrateur expirée ou révoquée" },
        { status: 401 }
      );
    }

    const admin = await getUserById(adminPayload.userId);
    if (!admin || !admin.isActive || !ADMIN_ROLES.includes(admin.role)) {
      return NextResponse.json(
        { error: "Accès refusé — rôle administrateur requis" },
        { status: 403 }
      );
    }

    // ─── 3. Valider la cible ──────────────────────────────────────────────────
    const { targetUserId } = await req.json();
    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json(
        { error: "targetUserId requis" },
        { status: 400 }
      );
    }

    if (targetUserId === admin.id) {
      return NextResponse.json(
        { error: "Impossible de s'impersonner soi-même" },
        { status: 400 }
      );
    }

    const targetUser = await getUserById(targetUserId);
    if (!targetUser) {
      return NextResponse.json(
        { error: "Utilisateur cible introuvable" },
        { status: 404 }
      );
    }

    // Aucun compte administrateur (ADMIN ou SUPER_ADMIN) ne peut être impersonné
    if (ADMIN_ROLES.includes(targetUser.role)) {
      return NextResponse.json(
        { error: "Impossible d'impersonner un compte administrateur" },
        { status: 403 }
      );
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        { error: "Le compte cible est désactivé" },
        { status: 403 }
      );
    }

    // ─── 4. Créer le JWT d'impersonation ─────────────────────────────────────
    // Le payload inclut les métadonnées d'impersonation pour un accès sans DB
    const impersonationJWT = createEncryptedJWT(
      {
        userId: targetUser.id,
        email: targetUser.email,
        isImpersonation: true,
        impersonatedBy: admin.id,
      },
      "15m"
    );

    // ─── 5. Persister la session d'impersonation ──────────────────────────────
    // Pas de refreshToken — impersonation non-renouvelable
    const fakeRefreshToken = crypto.randomBytes(64).toString("hex");
    const hashedFakeRefresh = crypto
      .createHash("sha256")
      .update(fakeRefreshToken)
      .digest("hex");

    await db.session.create({
      data: {
        userId: targetUser.id,
        sessionToken: impersonationJWT,
        refreshToken: hashedFakeRefresh,
        expires: new Date(Date.now() + IMPERSONATION_DURATION_MS),
        refreshTokenExpires: new Date(Date.now() + IMPERSONATION_DURATION_MS), // même expiry = non-renewable
        lastActivity: new Date(),
        isImpersonation: true,
        impersonatedBy: admin.id,
      },
    });

    // ─── 6. Réponse ───────────────────────────────────────────────────────────
    return NextResponse.json({
      impersonationToken: impersonationJWT,
      expiresAt: IMPERSONATION_DURATION_MS / 1000, // en secondes
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
    });
  } catch (error) {
    console.error("Erreur lors du démarrage de l'impersonation :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
