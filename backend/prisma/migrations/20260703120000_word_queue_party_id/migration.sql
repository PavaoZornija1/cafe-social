-- AlterTable
ALTER TABLE "WordMatchQueueEntry" ADD COLUMN "partyId" TEXT;

-- CreateIndex
CREATE INDEX "WordMatchQueueEntry_partyId_idx" ON "WordMatchQueueEntry"("partyId");

-- AddForeignKey
ALTER TABLE "WordMatchQueueEntry" ADD CONSTRAINT "WordMatchQueueEntry_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;
