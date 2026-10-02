-- CreateTable
CREATE TABLE "DeletedAccount" (
    "email" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedAccount_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE INDEX "DeletedAccount_deletedAt_idx" ON "DeletedAccount"("deletedAt");
