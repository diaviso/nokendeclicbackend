-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBRE', 'PARTENAIRE');

-- CreateEnum
CREATE TYPE "StatutProfessionnel" AS ENUM ('NON_PRECISE', 'EN_RECHERCHE', 'EN_POSTE', 'ETUDIANT', 'FREELANCE', 'CHOMAGE', 'RECONVERSION');

-- CreateEnum
CREATE TYPE "TypeOffre" AS ENUM ('EMPLOI', 'FORMATION', 'BOURSE', 'VOLONTARIAT', 'PROGRAMME');

-- CreateEnum
CREATE TYPE "TypeEmploi" AS ENUM ('CDI', 'CDD', 'STAGE', 'ALTERNANCE', 'FREELANCE', 'INTERIM', 'SAISONNIER', 'TEMPS_PARTIEL', 'TEMPS_PLEIN');

-- CreateEnum
CREATE TYPE "Secteur" AS ENUM ('INFORMATIQUE', 'FINANCE', 'SANTE', 'EDUCATION', 'COMMERCE', 'INDUSTRIE', 'AGRICULTURE', 'TOURISME', 'TRANSPORT', 'COMMUNICATION', 'ADMINISTRATION', 'ARTISANAT', 'CONSTRUCTION', 'ENERGIE', 'ENVIRONNEMENT', 'JURIDIQUE', 'MARKETING', 'RESSOURCES_HUMAINES', 'RECHERCHE', 'AUTRE');

-- CreateEnum
CREATE TYPE "NiveauExperience" AS ENUM ('DEBUTANT', 'JUNIOR', 'CONFIRME', 'SENIOR', 'EXPERT');

-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('HOMME', 'FEMME', 'AUTRE', 'NON_PRECISE');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'AMELIORATION', 'QUESTION', 'AUTRE');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OUVERT', 'EN_COURS', 'RESOLU', 'FERME');

-- CreateEnum
CREATE TYPE "FeedbackPriority" AS ENUM ('BASSE', 'MOYENNE', 'HAUTE', 'CRITIQUE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_OFFRE', 'NEW_MESSAGE', 'NEW_RETOUR', 'NEW_COMMENTAIRE', 'NEW_FEEDBACK_REPONSE');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBRE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "googleId" TEXT,
    "pictureUrl" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "isGoogleLogin" BOOLEAN NOT NULL DEFAULT false,
    "statutProfessionnel" "StatutProfessionnel" NOT NULL DEFAULT 'NON_PRECISE',
    "pays" TEXT,
    "region" TEXT,
    "departement" TEXT,
    "commune" TEXT,
    "sexe" "Sexe" NOT NULL DEFAULT 'NON_PRECISE',
    "dateNaissance" TIMESTAMP(3),
    "adresse" TEXT,
    "telephone" TEXT,
    "handicap" BOOLEAN NOT NULL DEFAULT false,
    "typeHandicap" TEXT,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offre" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "datePublication" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLimite" TIMESTAMP(3),
    "documentUrl" TEXT,
    "documentName" TEXT,
    "documentType" TEXT,
    "typeOffre" "TypeOffre" NOT NULL,
    "typeEmploi" "TypeEmploi",
    "secteur" "Secteur",
    "niveauExperience" "NiveauExperience",
    "tags" TEXT[],
    "localisation" TEXT,
    "entreprise" TEXT,
    "salaireMin" DOUBLE PRECISION,
    "salaireMax" DOUBLE PRECISION,
    "devise" TEXT NOT NULL DEFAULT 'FCFA',
    "organisme" TEXT,
    "dureeFormation" INTEGER,
    "certification" TEXT,
    "paysBourse" TEXT,
    "niveauEtude" TEXT,
    "montantBourse" DOUBLE PRECISION,
    "estRemboursable" BOOLEAN,
    "typeVolontariat" TEXT,
    "dureeVolontariat" INTEGER,
    "hebergement" BOOLEAN,
    "indemnite" DOUBLE PRECISION,
    "competencesRequises" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "estCloturee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "auteurId" INTEGER NOT NULL,

    CONSTRAINT "Offre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffreFichier" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "offreId" INTEGER NOT NULL,

    CONSTRAINT "OffreFichier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CV" (
    "id" SERIAL NOT NULL,
    "titreProfessionnel" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "codePostal" TEXT,
    "pays" TEXT,
    "linkedin" TEXT,
    "siteWeb" TEXT,
    "github" TEXT,
    "resume" TEXT,
    "competences" TEXT[],
    "langues" TEXT[],
    "certifications" TEXT[],
    "interets" TEXT[],
    "estPublic" BOOLEAN NOT NULL DEFAULT false,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModification" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "CV_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" SERIAL NOT NULL,
    "poste" TEXT NOT NULL,
    "entreprise" TEXT NOT NULL,
    "ville" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "enCours" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "cvId" INTEGER NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Formation" (
    "id" SERIAL NOT NULL,
    "diplome" TEXT NOT NULL,
    "etablissement" TEXT NOT NULL,
    "ville" TEXT,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "enCours" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "cvId" INTEGER NOT NULL,

    CONSTRAINT "Formation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "sujet" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "dateEnvoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estLu" BOOLEAN NOT NULL DEFAULT false,
    "expediteurId" INTEGER NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReponseMessage" (
    "id" SERIAL NOT NULL,
    "contenu" TEXT NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" INTEGER NOT NULL,
    "auteurId" INTEGER NOT NULL,

    CONSTRAINT "ReponseMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateConversation" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "user1Id" INTEGER NOT NULL,
    "user2Id" INTEGER NOT NULL,

    CONSTRAINT "PrivateConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateMessage" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "conversationId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,

    CONSTRAINT "PrivateMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commentaire" (
    "id" SERIAL NOT NULL,
    "contenu" TEXT NOT NULL,
    "datePublication" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteurId" INTEGER NOT NULL,
    "offreId" INTEGER NOT NULL,

    CONSTRAINT "Commentaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retour" (
    "id" SERIAL NOT NULL,
    "contenu" TEXT NOT NULL,
    "datePublication" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteurId" INTEGER NOT NULL,
    "offreId" INTEGER NOT NULL,

    CONSTRAINT "Retour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReponseRetour" (
    "id" SERIAL NOT NULL,
    "contenu" TEXT NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retourId" INTEGER NOT NULL,
    "auteurId" INTEGER NOT NULL,

    CONSTRAINT "ReponseRetour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "offreId" INTEGER NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "criteria" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSent" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" SERIAL NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categorie" "FeedbackCategory" NOT NULL,
    "statut" "FeedbackStatus" NOT NULL DEFAULT 'OUVERT',
    "priorite" "FeedbackPriority" NOT NULL DEFAULT 'MOYENNE',
    "pageUrl" TEXT,
    "capture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "auteurId" INTEGER NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackReponse" (
    "id" SERIAL NOT NULL,
    "contenu" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedbackId" INTEGER NOT NULL,
    "auteurId" INTEGER NOT NULL,

    CONSTRAINT "FeedbackReponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_googleId_idx" ON "User"("googleId");

-- CreateIndex
CREATE INDEX "EmailVerification_userId_idx" ON "EmailVerification"("userId");

-- CreateIndex
CREATE INDEX "EmailVerification_code_idx" ON "EmailVerification"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "PasswordReset_token_idx" ON "PasswordReset"("token");

-- CreateIndex
CREATE INDEX "Offre_typeOffre_idx" ON "Offre"("typeOffre");

-- CreateIndex
CREATE INDEX "Offre_secteur_idx" ON "Offre"("secteur");

-- CreateIndex
CREATE INDEX "Offre_localisation_idx" ON "Offre"("localisation");

-- CreateIndex
CREATE INDEX "Offre_datePublication_idx" ON "Offre"("datePublication");

-- CreateIndex
CREATE INDEX "Offre_auteurId_idx" ON "Offre"("auteurId");

-- CreateIndex
CREATE INDEX "OffreFichier_offreId_idx" ON "OffreFichier"("offreId");

-- CreateIndex
CREATE UNIQUE INDEX "CV_userId_key" ON "CV"("userId");

-- CreateIndex
CREATE INDEX "CV_userId_idx" ON "CV"("userId");

-- CreateIndex
CREATE INDEX "CV_estPublic_idx" ON "CV"("estPublic");

-- CreateIndex
CREATE INDEX "Experience_cvId_idx" ON "Experience"("cvId");

-- CreateIndex
CREATE INDEX "Formation_cvId_idx" ON "Formation"("cvId");

-- CreateIndex
CREATE INDEX "Message_expediteurId_idx" ON "Message"("expediteurId");

-- CreateIndex
CREATE INDEX "Message_estLu_idx" ON "Message"("estLu");

-- CreateIndex
CREATE INDEX "ReponseMessage_messageId_idx" ON "ReponseMessage"("messageId");

-- CreateIndex
CREATE INDEX "PrivateConversation_user1Id_idx" ON "PrivateConversation"("user1Id");

-- CreateIndex
CREATE INDEX "PrivateConversation_user2Id_idx" ON "PrivateConversation"("user2Id");

-- CreateIndex
CREATE UNIQUE INDEX "PrivateConversation_user1Id_user2Id_key" ON "PrivateConversation"("user1Id", "user2Id");

-- CreateIndex
CREATE INDEX "PrivateMessage_conversationId_idx" ON "PrivateMessage"("conversationId");

-- CreateIndex
CREATE INDEX "PrivateMessage_senderId_idx" ON "PrivateMessage"("senderId");

-- CreateIndex
CREATE INDEX "PrivateMessage_createdAt_idx" ON "PrivateMessage"("createdAt");

-- CreateIndex
CREATE INDEX "Commentaire_offreId_idx" ON "Commentaire"("offreId");

-- CreateIndex
CREATE INDEX "Commentaire_auteurId_idx" ON "Commentaire"("auteurId");

-- CreateIndex
CREATE INDEX "Retour_offreId_idx" ON "Retour"("offreId");

-- CreateIndex
CREATE INDEX "Retour_auteurId_idx" ON "Retour"("auteurId");

-- CreateIndex
CREATE INDEX "ReponseRetour_retourId_idx" ON "ReponseRetour"("retourId");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_offreId_key" ON "Favorite"("userId", "offreId");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "Alert_isActive_idx" ON "Alert"("isActive");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

-- CreateIndex
CREATE INDEX "Feedback_auteurId_idx" ON "Feedback"("auteurId");

-- CreateIndex
CREATE INDEX "Feedback_statut_idx" ON "Feedback"("statut");

-- CreateIndex
CREATE INDEX "Feedback_categorie_idx" ON "Feedback"("categorie");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- CreateIndex
CREATE INDEX "FeedbackReponse_feedbackId_idx" ON "FeedbackReponse"("feedbackId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offre" ADD CONSTRAINT "Offre_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffreFichier" ADD CONSTRAINT "OffreFichier_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "Offre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CV" ADD CONSTRAINT "CV_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "CV"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Formation" ADD CONSTRAINT "Formation_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "CV"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_expediteurId_fkey" FOREIGN KEY ("expediteurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReponseMessage" ADD CONSTRAINT "ReponseMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReponseMessage" ADD CONSTRAINT "ReponseMessage_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateConversation" ADD CONSTRAINT "PrivateConversation_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateConversation" ADD CONSTRAINT "PrivateConversation_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "PrivateConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateMessage" ADD CONSTRAINT "PrivateMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commentaire" ADD CONSTRAINT "Commentaire_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commentaire" ADD CONSTRAINT "Commentaire_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "Offre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retour" ADD CONSTRAINT "Retour_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retour" ADD CONSTRAINT "Retour_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "Offre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReponseRetour" ADD CONSTRAINT "ReponseRetour_retourId_fkey" FOREIGN KEY ("retourId") REFERENCES "Retour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReponseRetour" ADD CONSTRAINT "ReponseRetour_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_offreId_fkey" FOREIGN KEY ("offreId") REFERENCES "Offre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReponse" ADD CONSTRAINT "FeedbackReponse_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReponse" ADD CONSTRAINT "FeedbackReponse_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

