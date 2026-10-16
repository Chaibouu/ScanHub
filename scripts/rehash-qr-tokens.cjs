/**
 * Recalcule l'empreinte (tokenHash) des QR codes après un changement de QR_PEPPER.
 *
 *   node scripts/rehash-qr-tokens.cjs            # aperçu, ne modifie rien
 *   node scripts/rehash-qr-tokens.cjs --apply    # enregistre les nouvelles empreintes
 *
 * Seuls les QR dont ScanHub garde une copie chiffrée (tokenEnc : billets créés dans ScanHub
 * ou par l'API) peuvent être recalculés. Les autres sont listés : il faut les recréer.
 * Utilise DATABASE_URL, QR_PEPPER et AES_SECRET_KEY du fichier .env (ou de l'environnement).
 */
const crypto = require("crypto");
const path = require("path");

const root = path.resolve(__dirname, "..");
require("@next/env").loadEnvConfig(root, false, { info: () => {}, error: console.error });
const { PrismaClient } = require("@prisma/client");

const apply = process.argv.includes("--apply");

for (const name of ["DATABASE_URL", "QR_PEPPER", "AES_SECRET_KEY"]) {
  if (!process.env[name]) {
    console.error(`✖ ${name} doit être défini.`);
    process.exit(1);
  }
}

const aesKey = Buffer.from(process.env.AES_SECRET_KEY, "hex");

// Même format que aesEncrypt (lib/tokens.ts) : "iv.authTag.chiffré", en base64
function decrypt(value) {
  const [iv, tag, data] = value.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Même calcul que hashToken (lib/crypto.ts)
function hashToken(token) {
  return crypto.createHash("sha256").update(`${token.trim()}${process.env.QR_PEPPER}`).digest("hex");
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const qrs = await prisma.qRCode.findMany({ select: { id: true, tokenHash: true, tokenEnc: true } });
    let changed = 0;
    const missing = [];

    for (const qr of qrs) {
      if (!qr.tokenEnc) {
        missing.push(qr.id);
        continue;
      }
      const tokenHash = hashToken(decrypt(qr.tokenEnc));
      if (tokenHash === qr.tokenHash) continue;
      changed++;
      if (apply) await prisma.qRCode.update({ where: { id: qr.id }, data: { tokenHash } });
    }

    console.log(`${qrs.length} QR codes, ${changed} empreinte(s) ${apply ? "mise(s) à jour" : "à mettre à jour"}.`);
    if (missing.length) {
      console.log(`${missing.length} QR sans copie chiffrée (à recréer) : ${missing.join(", ")}`);
    }
    if (!apply && changed) console.log("Relancez avec --apply pour enregistrer.");
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
