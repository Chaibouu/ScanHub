import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getUserByEmail } from "@/data/user";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { SignupSchema } from "@/schemas";
import { checkPasswordPwned } from "@/lib/hibp";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { organizationService } from "@/modules/organizations/organizationService";
import { rateLimitRedisEmail } from "@/lib/rateLimitRedis";
import { getClientIP } from "@/lib/geo";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req);

    // Rate limiting strict sur les inscriptions (anti-spam / bots)
    const rlResponse = await rateLimitRedisEmail(ip);
    if (rlResponse) return rlResponse;

    const { name, email: rawEmail, password, organizationName } = await req.json();
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : rawEmail;

    if (!name)     return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    if (!email)    return NextResponse.json({ error: "L'adresse email est requise" }, { status: 400 });
    if (!password) return NextResponse.json({ error: "Le mot de passe est requis" }, { status: 400 });

    const parsedData = SignupSchema.safeParse({ name, email, password, organizationName });
    if (!parsedData.success) {
      return NextResponse.json(
        { error: parsedData.error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({ error: "L'email est déjà utilisé" }, { status: 400 });
    }

    // ─── Vérification HIBP — mot de passe compromis ? ─────────────────────────
    const { pwned, count } = await checkPasswordPwned(password);
    if (pwned) {
      return NextResponse.json(
        {
          error: `Ce mot de passe a été compromis dans ${count.toLocaleString("fr-FR")} fuite${count > 1 ? "s" : ""} de données. Choisissez un mot de passe différent.`,
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = await generateVerificationToken(email);

    // Inscription = ouverture d'un espace client, dont ce compte est l'administrateur.
    // Les autres membres (agents…) sont ensuite ajoutés depuis la page « Équipe ».
    const organization = await organizationService.create(parsedData.data.organizationName);
    await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "ADMIN",
        organizationId: organization.id,
        isActive: false,
        emailVerified: null,
      },
    });

    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (mailError) {
      if (process.env.NODE_ENV === "production") {
        // Sans email de vérification le compte serait inutilisable : on annule l'inscription
        await db.user.deleteMany({ where: { email } });
        await db.organization.delete({ where: { id: organization.id } });
        logger.error({ err: mailError }, "Envoi de l'email de vérification impossible");
        return NextResponse.json(
          { error: "Impossible d'envoyer l'email de vérification. Réessayez plus tard." },
          { status: 503 }
        );
      }
      // En développement (SMTP souvent absent), le lien est affiché dans la console du serveur
      logger.warn(
        { verifyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${encodeURIComponent(verificationToken)}` },
        "Email de vérification non envoyé (dev) — lien de vérification ci-contre"
      );
    }

    await audit({
      action: "SIGNUP",
      ipAddress: ip,
      status: "SUCCESS",
      metadata: { email, organizationId: organization.id },
    });

    return NextResponse.json(
      { message: "Inscription réussie. Vérifiez votre email pour confirmer votre compte." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de l'inscription :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
