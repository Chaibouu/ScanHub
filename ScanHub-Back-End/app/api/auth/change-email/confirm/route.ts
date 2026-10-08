import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generateVerificationToken,
  verifyVerificationToken,
} from "@/lib/tokens";
import {
  getVerificationTokenByTokenId,
  getVerificationTokenByToken,
} from "@/data/verification-token";
import { sendChangeEmailVerification } from "@/lib/mail";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token manquant" }, { status: 400 });
    }

    const { tokenPayload, error } = await verifyVerificationToken(token);

    if (error === "Token expiré") {
      const storedToken = await getVerificationTokenByToken(token);
      if (!storedToken) {
        return NextResponse.json(
          { error: "Token introuvable" },
          { status: 400 }
        );
      }

      const newToken = await generateVerificationToken(storedToken.email);
      await sendChangeEmailVerification(storedToken.email, newToken);

      return NextResponse.json(
        {
          error: "Token expiré. Un nouvel email de vérification a été envoyé.",
        },
        { status: 400 }
      );
    }

    if (error === "Token invalide") {
      return NextResponse.json({ error: "Token invalide" }, { status: 400 });
    }

    const { email, tokenId, userId } = tokenPayload as {
      email: string;
      tokenId: string;
      userId: string;
    };

    const storedToken = await getVerificationTokenByTokenId(tokenId);
    if (!storedToken) {
      return NextResponse.json(
        { error: "Token introuvable ou déjà utilisé" },
        { status: 400 }
      );
    }

    const user = await db.user.findFirst({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur introuvable" },
        { status: 404 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: { email: storedToken.email, emailVerified: new Date() },
    });

    await db.verificationToken.delete({ where: { id: storedToken.id } });

    return NextResponse.json(
      { message: "Adresse e-mail mise à jour avec succès." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de la vérification de l'email :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
