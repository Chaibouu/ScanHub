import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generateVerificationTokenForModifyEmail,
  getUserIdFromToken,
} from "@/lib/tokens";
import { sendChangeEmailVerification } from "@/lib/mail";

export async function POST(req: Request) {
  try {
    const { newEmail } = await req.json();
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    const userId = await getUserIdFromToken(token);

    if (!userId) {
      return NextResponse.json(
        { error: "Token invalide ou expiré" },
        { status: 401 }
      );
    }

    if (!newEmail) {
      return NextResponse.json(
        { error: "La nouvelle adresse e-mail est requise" },
        { status: 400 }
      );
    }

    const emailExists = await db.user.findUnique({
      where: { email: newEmail },
    });
    if (emailExists) {
      return NextResponse.json(
        { error: "Cette adresse e-mail est déjà utilisée" },
        { status: 400 }
      );
    }

    const verificationToken = await generateVerificationTokenForModifyEmail(
      newEmail,
      userId
    );

    await sendChangeEmailVerification(newEmail, verificationToken);

    return NextResponse.json(
      {
        message:
          "Un e-mail de confirmation a été envoyé à la nouvelle adresse.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de la demande de changement d'email :", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
