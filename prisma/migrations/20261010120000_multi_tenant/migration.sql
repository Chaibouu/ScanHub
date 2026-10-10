-- AlterTable
ALTER TABLE "User" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "qr_codes" ADD COLUMN     "tokenEnc" TEXT;

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Reprise des données existantes : les comptes (hors propriétaire de la plateforme)
-- sont rattachés à la première organisation créée.
UPDATE "User"
SET "organizationId" = (SELECT "id" FROM "organizations" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "role" <> 'SUPER_ADMIN' AND "organizationId" IS NULL;
