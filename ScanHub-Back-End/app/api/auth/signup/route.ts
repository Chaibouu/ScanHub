import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getUserByEmail } from "@/data/user";
import { generateVerificationToken } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/mail";
import { SignupSchema } from "@/schemas";
import { checkPasswordPwned } from "@/lib/hibp";
import { audit } from "@/lib/audit";
import { rateLimitRedisEmail } from "@/lib/rateLimitRedis";
import { getClientIP } from "@/lib/geo";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req);

    // Rate limiting strict sur les inscriptions (anti-spam / bots)
    const rlResponse = await rateLimitRedisEmail(ip);
    if (rlResponse) return rlResponse;

    const { name, email, password } = await req.json();

    if (!name)     return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    if (!email)    return NextResponse.json({ error: "L'adresse email est requise" }, { status: 400 });
    if (!password) return NextResponse.json({ error: "Le mot de passe est requis" }, { status: 400 });

    const parsedData = SignupSchema.safeParse({ name, email, password });
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

    await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isActive: false,
        emailVerified: null,
      },
    });

    await sendVerificationEmail(email, verificationToken);

    await audit({
      action: "SIGNUP",
      ipAddress: ip,
      status: "SUCCESS",
      metadata: { email },
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
