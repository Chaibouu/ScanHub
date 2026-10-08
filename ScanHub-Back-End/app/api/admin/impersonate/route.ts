import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { getFullTokenPayload, createEncryptedJWT } from "@/lib/tokens";
import { getUserById } from "@/data/user";
import type { NextRequest } from "next/server";

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

    const adminPayload = getFullTokenPayload(adminToken);
    if (!adminPayload?.userId) {
      return NextResponse.json(
        { error: "Token administrateur invalide ou expiré" },
        { status: 401 }
      );
    }

    // ─── 2. Vérifier le rôle ADMIN ────────────────────────────────────────────
    const admin = await getUserById(adminPayload.userId);
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Accès refusé — rôle ADMIN requis" },
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

    // Bloquer l'impersonation des autres ADMIN
    if (targetUser.role === "ADMIN") {
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
