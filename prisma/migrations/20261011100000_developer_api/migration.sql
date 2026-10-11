-- DropForeignKey
ALTER TABLE "scans" DROP CONSTRAINT "scans_userId_fkey";

-- AlterTable
ALTER TABLE "qr_codes" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "sourceId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- Reprise des données : la référence client était rangée dans les métadonnées.
-- En cas de doublon historique (même source, même référence), seul le plus ancien la conserve.
UPDATE "qr_codes" q
SET "externalId" = q."metadata"->>'externalId'
WHERE q."metadata"->>'externalId' IS NOT NULL
  AND q."id" = (
    SELECT q2."id" FROM "qr_codes" q2
    WHERE q2."sourceId" = q."sourceId"
      AND q2."metadata"->>'externalId' = q."metadata"->>'externalId'
    ORDER BY q2."createdAt" ASC, q2."id" ASC
    LIMIT 1
  );

-- Reprise des données : un scan appartient à l'espace de l'agent qui l'a réalisé,
-- et sa date de réception est, faute de mieux, sa date de contrôle.
UPDATE "scans" s
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE u."id" = s."userId";

UPDATE "scans" SET "createdAt" = "scannedAt";

-- CreateIndex
CREATE UNIQUE INDEX "qr_codes_sourceId_externalId_key" ON "qr_codes"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "scans_organizationId_createdAt_idx" ON "scans"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
