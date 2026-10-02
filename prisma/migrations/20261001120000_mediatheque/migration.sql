-- AlterTable
ALTER TABLE "Offre" ADD COLUMN     "imageId" INTEGER;

-- CreateTable
CREATE TABLE "Media" (
    "id" SERIAL NOT NULL,
    "cle" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "empreinte" TEXT,
    "nom" TEXT NOT NULL,
    "alt" TEXT,
    "largeur" INTEGER,
    "hauteur" INTEGER,
    "taille" INTEGER,
    "typeMime" TEXT,
    "commune" BOOLEAN NOT NULL DEFAULT false,
    "auteurId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Media_cle_key" ON "Media"("cle");

-- CreateIndex
CREATE INDEX "Media_empreinte_idx" ON "Media"("empreinte");

-- CreateIndex
CREATE INDEX "Media_auteurId_idx" ON "Media"("auteurId");

-- CreateIndex
CREATE INDEX "Media_createdAt_idx" ON "Media"("createdAt");

-- CreateIndex
CREATE INDEX "Offre_imageId_idx" ON "Offre"("imageId");

-- AddForeignKey
ALTER TABLE "Offre" ADD CONSTRAINT "Offre_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Reprise de l'existant ---------------------------------------------------
--
-- Chaque couverture déjà en ligne entre dans la médiathèque, et son offre y
-- est rattachée. Rien n'est retiré ni réécrit : `imageUrl` garde sa valeur,
-- la nouvelle colonne `imageId` est seulement renseignée. Les offres qui
-- partagent déjà une même URL pointent vers une seule entrée.
--
-- Le nom et le texte alternatif viennent de la plus ancienne offre qui
-- utilise l'image, son auteur en devient le déposant.
INSERT INTO "Media" ("cle", "url", "nom", "alt", "auteurId", "createdAt", "updatedAt")
SELECT DISTINCT ON (o."imageUrl")
    regexp_replace(regexp_replace(o."imageUrl", '^https?://[^/]+', ''), '^/+', ''),
    o."imageUrl",
    left(o."titre", 120),
    NULLIF(btrim(o."imageAlt"), ''),
    o."auteurId",
    o."createdAt",
    CURRENT_TIMESTAMP
FROM "Offre" o
WHERE o."imageUrl" IS NOT NULL AND btrim(o."imageUrl") <> ''
ORDER BY o."imageUrl", o."createdAt" ASC, o."id" ASC
ON CONFLICT ("cle") DO NOTHING;

UPDATE "Offre" o
SET "imageId" = m."id"
FROM "Media" m
WHERE m."url" = o."imageUrl" AND o."imageId" IS NULL;
