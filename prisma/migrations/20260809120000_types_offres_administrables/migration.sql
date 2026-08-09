-- Types d'offres administrables + champs dynamiques + photo de couverture
--
-- Migration écrite à la main : une génération automatique supprimerait les
-- colonnes spécifiques (organisme, paysBourse, typeVolontariat, salaire…) sans
-- en récupérer le contenu. Ici, leurs valeurs sont d'abord recopiées dans le
-- JSON `champs` avant que les colonnes ne disparaissent.

-- 0. Libération du nom « TypeOffre » ------------------------------------------
-- Une table crée en PostgreSQL un type composite portant son nom : impossible
-- de créer la table "TypeOffre" tant que l'énumération du même nom existe.
-- Elle est renommée ici, puis supprimée en fin de migration une fois la colonne
-- qui l'utilise convertie.

ALTER TYPE "TypeOffre" RENAME TO "TypeOffre_legacy";

-- 1. Nature des champs personnalisés ----------------------------------------

CREATE TYPE "TypeChamp" AS ENUM (
  'TEXTE', 'TEXTE_LONG', 'NOMBRE', 'DATE', 'BOOLEEN', 'LISTE', 'URL'
);

-- 2. Tables des types et de leurs champs -------------------------------------

CREATE TABLE "TypeOffre" (
  "id"          SERIAL PRIMARY KEY,
  "code"        TEXT NOT NULL,
  "libelle"     TEXT NOT NULL,
  "description" TEXT,
  "icone"       TEXT NOT NULL DEFAULT 'Briefcase',
  "couleur"     TEXT NOT NULL DEFAULT 'blue',
  "ordre"       INTEGER NOT NULL DEFAULT 0,
  "estActif"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "TypeOffre_code_key" ON "TypeOffre"("code");
CREATE INDEX "TypeOffre_estActif_ordre_idx" ON "TypeOffre"("estActif", "ordre");

CREATE TABLE "ChampTypeOffre" (
  "id"          SERIAL PRIMARY KEY,
  "typeOffreId" INTEGER NOT NULL,
  "code"        TEXT NOT NULL,
  "libelle"     TEXT NOT NULL,
  "type"        "TypeChamp" NOT NULL DEFAULT 'TEXTE',
  "obligatoire" BOOLEAN NOT NULL DEFAULT false,
  "options"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "placeholder" TEXT,
  "aide"        TEXT,
  "ordre"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChampTypeOffre_typeOffreId_fkey"
    FOREIGN KEY ("typeOffreId") REFERENCES "TypeOffre"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "ChampTypeOffre_typeOffreId_code_key"
  ON "ChampTypeOffre"("typeOffreId", "code");
CREATE INDEX "ChampTypeOffre_typeOffreId_ordre_idx"
  ON "ChampTypeOffre"("typeOffreId", "ordre");

-- 3. Reprise des cinq types existants ----------------------------------------

INSERT INTO "TypeOffre" ("code", "libelle", "description", "icone", "couleur", "ordre") VALUES
  ('EMPLOI',      'Emploi',      'Postes en entreprise, administration ou association.', 'Briefcase',     'blue',    1),
  ('FORMATION',   'Formation',   'Cursus, certifications et sessions de formation.',     'GraduationCap', 'emerald', 2),
  ('BOURSE',      'Bourse',      'Bourses d''études et aides au financement.',           'Award',         'violet',  3),
  ('VOLONTARIAT', 'Volontariat', 'Missions de service civique et de bénévolat.',         'HandHeart',     'orange',  4),
  ('PROGRAMME',   'Programme',   'Programmes d''accompagnement et incubation.',          'Globe2',        'teal',    5);

-- 4. Champs de chaque type, repris des anciennes colonnes --------------------

INSERT INTO "ChampTypeOffre" ("typeOffreId", "code", "libelle", "type", "ordre", "aide")
SELECT t."id", c."code", c."libelle", c."type"::"TypeChamp", c."ordre", c."aide"
FROM "TypeOffre" t
JOIN (VALUES
  -- Emploi
  ('EMPLOI',      'salaireMin',          'Salaire minimum',       'NOMBRE',     1, 'En FCFA'),
  ('EMPLOI',      'salaireMax',          'Salaire maximum',       'NOMBRE',     2, 'En FCFA'),
  -- Formation
  ('FORMATION',   'organisme',           'Organisme',             'TEXTE',      1, NULL),
  ('FORMATION',   'dureeFormation',      'Durée',                 'NOMBRE',     2, 'En mois'),
  ('FORMATION',   'certification',       'Certification délivrée','TEXTE',      3, NULL),
  -- Bourse
  ('BOURSE',      'paysBourse',          'Pays d''accueil',       'TEXTE',      1, NULL),
  ('BOURSE',      'niveauEtude',         'Niveau d''étude',       'TEXTE',      2, 'Licence, Master…'),
  ('BOURSE',      'montantBourse',       'Montant',               'NOMBRE',     3, 'En FCFA'),
  ('BOURSE',      'estRemboursable',     'Remboursable',          'BOOLEEN',    4, NULL),
  -- Volontariat
  ('VOLONTARIAT', 'typeVolontariat',     'Type de mission',       'TEXTE',      1, NULL),
  ('VOLONTARIAT', 'dureeVolontariat',    'Durée',                 'NOMBRE',     2, 'En mois'),
  ('VOLONTARIAT', 'hebergement',         'Hébergement inclus',    'BOOLEEN',    3, NULL),
  ('VOLONTARIAT', 'indemnite',           'Indemnité',             'NOMBRE',     4, 'En FCFA'),
  ('VOLONTARIAT', 'competencesRequises', 'Compétences requises',  'TEXTE_LONG', 5, NULL),
  -- Programme
  ('PROGRAMME',   'typeVolontariat',     'Type de programme',     'TEXTE',      1, NULL),
  ('PROGRAMME',   'dureeVolontariat',    'Durée',                 'NOMBRE',     2, 'En mois'),
  ('PROGRAMME',   'competencesRequises', 'Profil recherché',      'TEXTE_LONG', 3, NULL)
) AS c("typeCode", "code", "libelle", "type", "ordre", "aide")
  ON c."typeCode" = t."code";

-- 5. Nouvelles colonnes sur Offre --------------------------------------------

ALTER TABLE "Offre"
  ADD COLUMN "typeOffreId" INTEGER,
  ADD COLUMN "champs"     JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "imageUrl"   TEXT;

-- 6. Rattachement des offres existantes à leur type --------------------------

UPDATE "Offre" o
SET "typeOffreId" = t."id"
FROM "TypeOffre" t
WHERE t."code" = o."typeOffre"::TEXT;

-- Filet : aucune offre ne doit rester orpheline. Si un type inattendu existait,
-- la contrainte NOT NULL ci-dessous ferait échouer la migration — c'est
-- volontaire, mieux vaut interrompre que rattacher au hasard.

-- 7. Report des valeurs spécifiques dans le JSON -----------------------------
-- `jsonb_strip_nulls` élimine les clés dont la valeur est absente : une offre
-- sans salaire renseigné garde un objet vide plutôt que des clés à null.

UPDATE "Offre" SET "champs" = jsonb_strip_nulls(jsonb_build_object(
  'salaireMin',          to_jsonb("salaireMin"),
  'salaireMax',          to_jsonb("salaireMax"),
  'organisme',           to_jsonb("organisme"),
  'dureeFormation',      to_jsonb("dureeFormation"),
  'certification',       to_jsonb("certification"),
  'paysBourse',          to_jsonb("paysBourse"),
  'niveauEtude',         to_jsonb("niveauEtude"),
  'montantBourse',       to_jsonb("montantBourse"),
  'estRemboursable',     to_jsonb("estRemboursable"),
  'typeVolontariat',     to_jsonb("typeVolontariat"),
  'dureeVolontariat',    to_jsonb("dureeVolontariat"),
  'hebergement',         to_jsonb("hebergement"),
  'indemnite',           to_jsonb("indemnite"),
  'competencesRequises', to_jsonb("competencesRequises")
));

-- 8. Verrouillage de la relation ---------------------------------------------

ALTER TABLE "Offre" ALTER COLUMN "typeOffreId" SET NOT NULL;

ALTER TABLE "Offre"
  ADD CONSTRAINT "Offre_typeOffreId_fkey"
  FOREIGN KEY ("typeOffreId") REFERENCES "TypeOffre"("id") ON DELETE RESTRICT;

CREATE INDEX "Offre_typeOffreId_idx" ON "Offre"("typeOffreId");

-- 9. Retrait de l'ancien modèle ----------------------------------------------

DROP INDEX IF EXISTS "Offre_typeOffre_idx";

ALTER TABLE "Offre"
  DROP COLUMN "typeOffre",
  DROP COLUMN "salaireMin",
  DROP COLUMN "salaireMax",
  DROP COLUMN "devise",
  DROP COLUMN "organisme",
  DROP COLUMN "dureeFormation",
  DROP COLUMN "certification",
  DROP COLUMN "paysBourse",
  DROP COLUMN "niveauEtude",
  DROP COLUMN "montantBourse",
  DROP COLUMN "estRemboursable",
  DROP COLUMN "typeVolontariat",
  DROP COLUMN "dureeVolontariat",
  DROP COLUMN "hebergement",
  DROP COLUMN "indemnite",
  DROP COLUMN "competencesRequises";

DROP TYPE "TypeOffre_legacy";
