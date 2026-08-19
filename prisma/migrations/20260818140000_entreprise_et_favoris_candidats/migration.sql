-- Fiche entreprise des partenaires, et favoris de candidats.
-- Strictement additive : deux nouvelles tables, aucune colonne existante touchée.

CREATE TABLE "EntreprisePartenaire" (
  "id"                SERIAL       NOT NULL,
  "userId"            INTEGER      NOT NULL,
  "nom"               TEXT         NOT NULL,
  "logoUrl"           TEXT,
  "description"       TEXT,
  "secteur"           "Secteur",
  "siteWeb"           TEXT,
  "emailContact"      TEXT,
  "telephone"         TEXT,
  "ville"             TEXT,
  "region"            TEXT,
  "taille"            TEXT,
  "estVisibleVitrine" BOOLEAN      NOT NULL DEFAULT false,
  "ordreVitrine"      INTEGER      NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EntreprisePartenaire_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EntreprisePartenaire_userId_key" ON "EntreprisePartenaire"("userId");
CREATE INDEX "EntreprisePartenaire_estVisibleVitrine_ordreVitrine_idx"
  ON "EntreprisePartenaire"("estVisibleVitrine", "ordreVitrine");

ALTER TABLE "EntreprisePartenaire"
  ADD CONSTRAINT "EntreprisePartenaire_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FavoriCandidat" (
  "id"           SERIAL       NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "partenaireId" INTEGER      NOT NULL,
  "candidatId"   INTEGER      NOT NULL,
  "note"         TEXT,
  CONSTRAINT "FavoriCandidat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FavoriCandidat_partenaireId_candidatId_key"
  ON "FavoriCandidat"("partenaireId", "candidatId");
CREATE INDEX "FavoriCandidat_partenaireId_createdAt_idx"
  ON "FavoriCandidat"("partenaireId", "createdAt");

ALTER TABLE "FavoriCandidat"
  ADD CONSTRAINT "FavoriCandidat_partenaireId_fkey"
  FOREIGN KEY ("partenaireId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FavoriCandidat"
  ADD CONSTRAINT "FavoriCandidat_candidatId_fkey"
  FOREIGN KEY ("candidatId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
