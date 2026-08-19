-- Traçabilité du consentement aux CGU.
--
-- Strictement additive, et volontairement sans valeur par défaut : les comptes
-- existants restent à NULL. Leur inventer une acceptation qu'ils n'ont jamais
-- donnée serait un faux — ils se verront demander leur accord à la connexion
-- suivante.

ALTER TABLE "User"
  ADD COLUMN "cguVersion" TEXT,
  ADD COLUMN "cguAccepteeLe" TIMESTAMP(3);
