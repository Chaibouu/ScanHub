-- AlterTable
ALTER TABLE "qr_codes" ADD COLUMN     "offlineHash" TEXT;

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activationCodeHash" TEXT,
ADD COLUMN     "activationExpiresAt" TIMESTAMP(3),
ALTER COLUMN "deviceKeyHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "qr_codes_offlineHash_key" ON "qr_codes"("offlineHash");

-- CreateIndex
CREATE INDEX "qr_codes_eventId_idx" ON "qr_codes"("eventId");

-- CreateIndex
CREATE INDEX "qr_codes_sourceId_idx" ON "qr_codes"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_activationCodeHash_key" ON "devices"("activationCodeHash");

-- CreateIndex
CREATE INDEX "scans_eventId_result_idx" ON "scans"("eventId", "result");

-- CreateIndex
CREATE INDEX "scans_deviceId_idx" ON "scans"("deviceId");

-- CreateIndex
CREATE INDEX "scans_scannedAt_idx" ON "scans"("scannedAt");


-- Les anciennes "clés" de terminaux étaient prévisibles (jamais de vrais secrets) :
-- on les invalide, les terminaux existants devront être réactivés par code.
UPDATE "devices" SET "deviceKeyHash" = NULL;
