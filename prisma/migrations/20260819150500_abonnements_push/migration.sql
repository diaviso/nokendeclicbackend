-- DropForeignKey
ALTER TABLE "ChampTypeOffre" DROP CONSTRAINT "ChampTypeOffre_typeOffreId_fkey";

-- DropForeignKey
ALTER TABLE "Offre" DROP CONSTRAINT "Offre_typeOffreId_fkey";

-- DropForeignKey
ALTER TABLE "OffreLike" DROP CONSTRAINT "OffreLike_offreId_fkey";

-- DropForeignKey
ALTER TABLE "OffreLike" DROP CONSTRAINT "OffreLike_userId_fkey";

-- AlterTable
ALTER TABLE "ChampTypeOffre" ALTER COLUMN "options" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TypeOffre" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "derniereReussite" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "ChampTypeOffre" ADD CONSTRAINT "ChampTypeOffre_typeOffreId_fkey" FOREIGN KEY ("typeOffreId") REFERENCES "TypeOffre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offre" ADD CONSTRAINT "Offre_typeOffreId_fkey" FOREIGN KEY ("typeOffreId") REFERENCES "TypeOffre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffreLike" ADD CONSTRAINT "OffreLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffreLike" ADD CONSTRAINT "OffreLike_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "Offre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
