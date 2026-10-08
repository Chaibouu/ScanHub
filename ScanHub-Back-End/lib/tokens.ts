import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db";
import { getVerificationTokenByEmail } from "@/data/verification-token";
import { getPasswordResetTokenByEmail } from "@/data/password-reset-token";
import { getTwoFactorTokenByEmail } from "@/data/two-factor-token";
import { JwtPayload, TokenExpiredError } from "jsonwebtoken";
import { verify, sign } from "jsonwebtoken";

const privateKey = process.env.RSA_PRIVATE_KEY as string;
const publicKey = process.env.RSA_PUBLIC_KEY as string;
const aesSecretKey = Buffer.from(process.env.AES_SECRET_KEY as string, "hex");
const ALGORITHM = "RS256"; // Algorithme de signature RSA (RS256)

// ─── Helpers AES-256-GCM ──────────────────────────────────────────────────────

/**
 * Chiffre une chaîne avec AES-256-GCM.
 * Retourne "ivBase64.authTagBase64.encryptedBase64"
 */
function aesEncrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12); // 96 bits recommandé pour GCM
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    aesSecretKey,
    iv
  ) as crypto.CipherGCM;

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");

  return `${iv.toString("base64")}.${authTag}.${encrypted}`;
}

/**
 * Déchiffre un token produit par aesEncrypt().
 * Lève une erreur si l'intégrité (authTag) est invalide.
 */
function aesDecrypt(encryptedToken: string): string {
  const [ivBase64, authTagBase64, encryptedBase64] = encryptedToken.split(".");

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const encrypted = Buffer.from(encryptedBase64, "base64");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    aesSecretKey,
    iv
  ) as crypto.DecipherGCM;

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// ─── Two-Factor Token ─────────────────────────────────────────────────────────

export const generateTwoFactorToken = async (email: string) => {
  const token = crypto.randomInt(100_000, 1_000_000).toString();
  const expires = new Date(new Date().getTime() + 5 * 60 * 1000);

  const existingToken = await getTwoFactorTokenByEmail(email);
  if (existingToken) {
    await db.twoFactorToken.delete({ where: { id: existingToken.id } });
  }

  const twoFactorToken = await db.twoFactorToken.create({
    data: { email, token, expires },
  });

  return twoFactorToken;
};

// ─── Password Reset Token ─────────────────────────────────────────────────────

export const generatePasswordResetToken = async (email: string) => {
  const tokenId = uuidv4();
  const expires = new Date(new Date().getTime() + 3600 * 1000); // 1 heure

  const payload = { email, tokenId, expires: expires.toISOString() };
  const signedToken = sign(payload, privateKey, {
    algorithm: ALGORITHM,
    expiresIn: "1h",
  });

  const encryptedToken = aesEncrypt(signedToken);

  // Remplacer l'ancien token s'il existe
  const existingToken = await getPasswordResetTokenByEmail(email);
  if (existingToken) {
    await db.passwordResetToken.delete({ where: { id: existingToken.id } });
  }

  await db.passwordResetToken.create({
    data: { email, token: encryptedToken, expires, tokenId },
  });

  return encryptedToken;
};

export const verifyPasswordResetToken = async (encryptedToken: string) => {
  try {
    const decryptedToken = aesDecrypt(encryptedToken);
    const decodedToken = verify(decryptedToken, publicKey, {
      algorithms: ["RS256"],
    });
    return { tokenPayload: decodedToken };
  } catch (error: unknown) {
    if (error instanceof TokenExpiredError) {
      return { error: "Token expiré" };
    }
    console.error("Erreur lors de la vérification du token :", error);
    return { error: "Token invalide" };
  }
};

// ─── Email Verification Token ─────────────────────────────────────────────────

export const generateVerificationToken = async (email: string) => {
  const tokenId = uuidv4();
  const expires = new Date(new Date().getTime() + 3600 * 1000); // 1 heure

  const payload = { email, tokenId, expires: expires.toISOString() };
  const signedToken = sign(payload, privateKey, {
    algorithm: ALGORITHM,
    expiresIn: "1h",
  });

  const encryptedToken = aesEncrypt(signedToken);

  const existingToken = await getVerificationTokenByEmail(email);
  if (existingToken) {
    await db.verificationToken.delete({ where: { id: existingToken.id } });
  }

  await db.verificationToken.create({
    data: { email, token: encryptedToken, expires, tokenId },
  });

  return encryptedToken;
};

export const verifyVerificationToken = async (encryptedToken: string) => {
  try {
    const decryptedToken = aesDecrypt(encryptedToken);
    const decodedToken = verify(decryptedToken, publicKey, {
      algorithms: [ALGORITHM],
    });
    return { tokenPayload: decodedToken };
  } catch (error: unknown) {
    if (error instanceof TokenExpiredError) {
      return { error: "Token expiré" };
    }
    console.error("Erreur lors de la vérification du token :", error);
    return { error: "Token invalide" };
  }
};

// ─── Verification Token (changement d'email) ──────────────────────────────────

export const generateVerificationTokenForModifyEmail = async (
  email: string,
  userId: string
) => {
  const tokenId = uuidv4();
  const expires = new Date(new Date().getTime() + 3600 * 1000); // 1 heure

  const payload = { email, tokenId, expires: expires.toISOString(), userId };
  const signedToken = sign(payload, privateKey, {
    algorithm: ALGORITHM,
    expiresIn: "1h",
  });

  const encryptedToken = aesEncrypt(signedToken);

  const existingToken = await getVerificationTokenByEmail(email);
  if (existingToken) {
    await db.verificationToken.delete({ where: { id: existingToken.id } });
  }

  await db.verificationToken.create({
    data: { email, token: encryptedToken, expires, tokenId, userId },
  });

  return encryptedToken;
};

// ─── Access JWT (session) ─────────────────────────────────────────────────────

/** Crée un JWT signé RSA puis chiffré AES-256-GCM. */
export const createEncryptedJWT = (payload: object, expiresIn: string): string => {
  const token = sign(payload, privateKey, {
    algorithm: ALGORITHM,
    expiresIn: expiresIn as unknown as number,
  });
  return aesEncrypt(token);
};

/** Déchiffre et vérifie un JWT produit par createEncryptedJWT(). */
export const verifyEncryptedJWT = (encryptedToken: string): JwtPayload | string => {
  const decryptedToken = aesDecrypt(encryptedToken);
  return verify(decryptedToken, publicKey, { algorithms: ["RS256"] });
};

/** Hache un refresh token (SHA-256) — seul le hash est stocké en base. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface TokenPayload extends JwtPayload {
  userId: string;
  email?: string;
  isImpersonation?: boolean;
  impersonatedBy?: string;
  purpose?: string;
}

function decodePayload(token: string): TokenPayload | null {
  try {
    const decoded = verifyEncryptedJWT(token);
    if (typeof decoded === "object" && (decoded as JwtPayload).userId) {
      return decoded as TokenPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Déchiffre et vérifie un JWT d'accès, retourne le payload complet.
 * Les tokens à usage restreint (ex: challenge 2FA, `purpose` défini) sont refusés :
 * ils ne doivent jamais servir de token d'accès.
 */
export function getFullTokenPayload(token: string): TokenPayload | null {
  const payload = decodePayload(token);
  if (!payload || payload.purpose) return null;
  return payload;
}

/**
 * Déchiffre et vérifie un token à usage restreint (ex: "2fa_challenge").
 * Retourne null si le token n'a pas exactement l'usage attendu.
 */
export function getPurposeTokenPayload(token: string, purpose: string): TokenPayload | null {
  const payload = decodePayload(token);
  if (!payload || payload.purpose !== purpose) return null;
  return payload;
}

/** Extrait l'userId depuis un JWT d'accès chiffré. Retourne null si invalide. */
export async function getUserIdFromToken(token: string): Promise<string | null> {
  return getFullTokenPayload(token)?.userId ?? null;
}
