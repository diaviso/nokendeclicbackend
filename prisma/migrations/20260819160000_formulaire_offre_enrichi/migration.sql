-- AlterTable
ALTER TABLE "Offre" ADD COLUMN     "contenuHtml" TEXT,
ADD COLUMN     "datePublicationPrevue" TIMESTAMP(3),
ADD COLUMN     "emailCandidature" TEXT,
ADD COLUMN     "estBrouillon" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estEpinglee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "extrait" TEXT,
ADD COLUMN     "imageAlt" TEXT,
ADD COLUMN     "instructionsCandidature" TEXT,
ADD COLUMN     "metaDescription" TEXT,
ADD COLUMN     "metaTitre" TEXT,
ADD COLUMN     "nombrePostes" INTEGER,
ADD COLUMN     "salaireDevise" TEXT,
ADD COLUMN     "salaireMax" INTEGER,
ADD COLUMN     "salaireMin" INTEGER,
ADD COLUMN     "salairePeriode" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "teletravail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Offre_slug_key" ON "Offre"("slug");

-- CreateIndex
CREATE INDEX "Offre_estBrouillon_idx" ON "Offre"("estBrouillon");

-- CreateIndex
CREATE INDEX "Offre_slug_idx" ON "Offre"("slug");

