-- « J'aime » public sur les offres.
--
-- Distinct de Favorite, qui reste un marque-page privé : le like est un signal
-- public dont le total est affiché. Les deux coexistent volontairement, pour
-- qu'enregistrer une offre n'oblige pas à la recommander publiquement.

CREATE TABLE "OffreLike" (
  "id"        SERIAL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId"    INTEGER NOT NULL,
  "offreId"   INTEGER NOT NULL,
  CONSTRAINT "OffreLike_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "OffreLike_offreId_fkey"
    FOREIGN KEY ("offreId") REFERENCES "Offre"("id") ON DELETE CASCADE
);

-- Un utilisateur ne peut aimer une offre qu'une fois : la contrainte porte la
-- règle, plutôt qu'un contrôle applicatif sujet aux doubles clics concurrents.
CREATE UNIQUE INDEX "OffreLike_userId_offreId_key" ON "OffreLike"("userId", "offreId");
CREATE INDEX "OffreLike_offreId_idx" ON "OffreLike"("offreId");
CREATE INDEX "OffreLike_userId_idx" ON "OffreLike"("userId");
