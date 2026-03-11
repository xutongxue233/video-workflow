-- AlterTable
ALTER TABLE "Script" ADD COLUMN "generatorModel" TEXT;
ALTER TABLE "Script" ADD COLUMN "structuredJson" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RenderJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "scriptId" TEXT,
    "templateId" TEXT NOT NULL,
    "voiceStyle" TEXT NOT NULL,
    "aspectRatio" TEXT NOT NULL,
    "provider" TEXT,
    "externalJobId" TEXT,
    "externalStatus" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RenderJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RenderJob_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RenderJob" ("aspectRatio", "createdAt", "errorMessage", "finishedAt", "id", "idempotencyKey", "projectId", "queuedAt", "scriptId", "startedAt", "status", "templateId", "updatedAt", "voiceStyle") SELECT "aspectRatio", "createdAt", "errorMessage", "finishedAt", "id", "idempotencyKey", "projectId", "queuedAt", "scriptId", "startedAt", "status", "templateId", "updatedAt", "voiceStyle" FROM "RenderJob";
DROP TABLE "RenderJob";
ALTER TABLE "new_RenderJob" RENAME TO "RenderJob";
CREATE UNIQUE INDEX "RenderJob_idempotencyKey_key" ON "RenderJob"("idempotencyKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
