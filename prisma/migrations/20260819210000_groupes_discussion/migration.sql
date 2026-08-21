-- CreateEnum
CREATE TYPE "RoleGroupe" AS ENUM ('ADMIN', 'MEMBRE');

-- CreateEnum
CREATE TYPE "StatutInvitation" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE');

-- AlterTable
ALTER TABLE "PrivateConversation" ADD COLUMN     "masqueePourUser1" TIMESTAMP(3),
ADD COLUMN     "masqueePourUser2" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "GroupeDiscussion" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "creeParId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupeDiscussion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembreGroupe" (
    "id" SERIAL NOT NULL,
    "groupeId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "RoleGroupe" NOT NULL DEFAULT 'MEMBRE',
    "rejointLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "luJusquA" TIMESTAMP(3),

    CONSTRAINT "MembreGroupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageGroupe" (
    "id" SERIAL NOT NULL,
    "contenu" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupeId" INTEGER NOT NULL,
    "auteurId" INTEGER,

    CONSTRAINT "MessageGroupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvitationGroupe" (
    "id" SERIAL NOT NULL,
    "groupeId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "inviteParId" INTEGER,
    "statut" "StatutInvitation" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repondueLe" TIMESTAMP(3),

    CONSTRAINT "InvitationGroupe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MembreGroupe_userId_idx" ON "MembreGroupe"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MembreGroupe_groupeId_userId_key" ON "MembreGroupe"("groupeId", "userId");

-- CreateIndex
CREATE INDEX "MessageGroupe_groupeId_createdAt_idx" ON "MessageGroupe"("groupeId", "createdAt");

-- CreateIndex
CREATE INDEX "InvitationGroupe_userId_statut_idx" ON "InvitationGroupe"("userId", "statut");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationGroupe_groupeId_userId_key" ON "InvitationGroupe"("groupeId", "userId");

-- AddForeignKey
ALTER TABLE "GroupeDiscussion" ADD CONSTRAINT "GroupeDiscussion_creeParId_fkey" FOREIGN KEY ("creeParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreGroupe" ADD CONSTRAINT "MembreGroupe_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "GroupeDiscussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembreGroupe" ADD CONSTRAINT "MembreGroupe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageGroupe" ADD CONSTRAINT "MessageGroupe_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "GroupeDiscussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageGroupe" ADD CONSTRAINT "MessageGroupe_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationGroupe" ADD CONSTRAINT "InvitationGroupe_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "GroupeDiscussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationGroupe" ADD CONSTRAINT "InvitationGroupe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationGroupe" ADD CONSTRAINT "InvitationGroupe_inviteParId_fkey" FOREIGN KEY ("inviteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

