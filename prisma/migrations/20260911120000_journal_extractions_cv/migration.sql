-- CreateTable
CREATE TABLE "ExtractionCV" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "succes" BOOLEAN NOT NULL,
    "mode" TEXT NOT NULL,
    "typeFichier" TEXT NOT NULL,
    "tailleKo" INTEGER NOT NULL,
    "experiences" INTEGER NOT NULL DEFAULT 0,
    "formations" INTEGER NOT NULL DEFAULT 0,
    "competences" INTEGER NOT NULL DEFAULT 0,
    "erreur" TEXT,

    CONSTRAINT "ExtractionCV_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractionCV_createdAt_idx" ON "ExtractionCV"("createdAt");

-- CreateIndex
CREATE INDEX "ExtractionCV_userId_idx" ON "ExtractionCV"("userId");

-- AddForeignKey
ALTER TABLE "ExtractionCV" ADD CONSTRAINT "ExtractionCV_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

