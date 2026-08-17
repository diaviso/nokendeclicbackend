-- Modération des offres déposées par les partenaires.
--
-- Migration strictement additive. Le défaut est PUBLIEE, et non EN_ATTENTE :
-- toutes les offres déjà en base ont été publiées par l'administration et
-- doivent rester au catalogue. Un défaut à EN_ATTENTE les en retirerait toutes
-- au déploiement.

CREATE TYPE "StatutModeration" AS ENUM ('EN_ATTENTE', 'PUBLIEE', 'REFUSEE');

ALTER TABLE "Offre"
  ADD COLUMN "statutModeration" "StatutModeration" NOT NULL DEFAULT 'PUBLIEE',
  ADD COLUMN "motifRefus" TEXT,
  ADD COLUMN "dateModeration" TIMESTAMP(3),
  ADD COLUMN "modereParId" INTEGER;

ALTER TABLE "Offre"
  ADD CONSTRAINT "Offre_modereParId_fkey"
  FOREIGN KEY ("modereParId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Le catalogue public filtre sur ce champ à chaque requête.
CREATE INDEX "Offre_statutModeration_idx" ON "Offre"("statutModeration");
