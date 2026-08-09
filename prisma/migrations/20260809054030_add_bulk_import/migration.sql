-- CreateTable
CREATE TABLE "BulkImportLog" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedBy" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "errorDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingBulkImport" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedBy" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "errors" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingBulkImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingBulkImport_expiresAt_idx" ON "PendingBulkImport"("expiresAt");
