import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CVService } from '../cv/cv.service';
import {
  EntreprisePartenaireDto,
  NoteFavoriDto,
  VitrineDto,
} from './dto/partenaire.dto';

@Injectable()
export class PartenaireService {
  constructor(private prisma: PrismaService) {}

  /* ------------------------------------------------------------ Entreprise */

  /** Fiche de la structure du partenaire connecté, ou `null` si non créée. */
  async monEntreprise(userId: number) {
    return this.prisma.entreprisePartenaire.findUnique({
      where: { userId },
    });
  }

  /**
   * Crée ou met à jour la fiche.
   *
   * Un `upsert` plutôt qu'un couple création/modification : du point de vue du
   * partenaire il n'existe qu'un formulaire, qu'il remplisse pour la première
   * fois ou qu'il corrige une ligne.
   *
   * Les réglages de vitrine ne figurent pas ici : ils relèvent de
   * l'administration, une structure ne se met pas elle-même en avant sur la
   * page d'accueil.
   */
  async enregistrerEntreprise(userId: number, dto: EntreprisePartenaireDto) {
    return this.prisma.entreprisePartenaire.upsert({
      where: { userId },
      update: { ...dto },
      create: { ...dto, userId },
    });
  }

  /** Enregistre le logo après envoi du fichier. */
  async definirLogo(userId: number, logoUrl: string | null) {
    const fiche = await this.prisma.entreprisePartenaire.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!fiche) {
      throw new BadRequestException(
        "Renseignez d'abord le nom de votre structure avant d'envoyer un logo",
      );
    }

    return this.prisma.entreprisePartenaire.update({
      where: { userId },
      data: { logoUrl },
    });
  }

  /* --------------------------------------------------------------- Favoris */

  /**
   * Candidats mis de côté par le partenaire.
   *
   * La projection reprend celle des recruteurs (`CVService.SELECT_RECRUTEUR`) :
   * un profil mis en favori ne doit pas livrer plus d'informations qu'il n'en
   * livrait dans la recherche — ni téléphone, ni adresse.
   *
   * Un candidat qui a retiré la visibilité de son CV depuis la mise en favori
   * est signalé plutôt que supprimé : le partenaire comprend pourquoi la fiche
   * n'est plus consultable, au lieu de la voir disparaître sans explication.
   */
  async mesFavoris(partenaireId: number) {
    const favoris = await this.prisma.favoriCandidat.findMany({
      where: { partenaireId },
      orderBy: { createdAt: 'desc' },
      include: {
        candidat: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            pictureUrl: true,
            statutProfessionnel: true,
            region: true,
            isActive: true,
            cv: { select: CVService.SELECT_RECRUTEUR },
          },
        },
      },
    });

    return favoris.map((favori) => {
      const { candidat, ...reste } = favori;
      const { cv, isActive, ...profil } = candidat;
      const visible = Boolean(cv) && isActive;

      return {
        ...reste,
        candidat: profil,
        // Le CV n'est joint que s'il est toujours visible ; sinon on ne renvoie
        // rien, et l'indicateur explique l'absence.
        cv: visible ? cv : null,
        profilToujoursVisible: visible,
      };
    });
  }

  async ajouterFavori(partenaireId: number, candidatId: number, dto: NoteFavoriDto) {
    if (partenaireId === candidatId) {
      throw new BadRequestException('Vous ne pouvez pas vous ajouter en favori');
    }

    const candidat = await this.prisma.user.findUnique({
      where: { id: candidatId },
      select: { id: true, role: true, isActive: true, cv: { select: { estPublic: true } } },
    });

    if (!candidat || !candidat.isActive) {
      throw new NotFoundException('Candidat non trouvé');
    }

    // Même règle que la recherche : on ne met de côté que ce qu'on avait le
    // droit de consulter.
    if (candidat.role !== 'MEMBRE' || candidat.cv?.estPublic !== true) {
      throw new BadRequestException(
        "Ce membre n'a pas rendu son profil visible aux recruteurs",
      );
    }

    // Une note vidée par le partenaire est effacée, pas stockée en chaîne
    // vide : `update` avec `undefined` laisserait au contraire l'ancienne
    // annotation en place, et le geste n'aurait aucun effet visible.
    const note = dto.note?.trim() || null;

    return this.prisma.favoriCandidat.upsert({
      where: { partenaireId_candidatId: { partenaireId, candidatId } },
      update: { note },
      create: { partenaireId, candidatId, note },
    });
  }

  async retirerFavori(partenaireId: number, candidatId: number) {
    await this.prisma.favoriCandidat.deleteMany({
      where: { partenaireId, candidatId },
    });
    return { message: 'Retiré de vos favoris' };
  }

  /**
   * Identifiants des candidats déjà en favori.
   *
   * Sert à marquer les résultats de recherche d'un seul appel, plutôt que
   * d'interroger le serveur profil par profil.
   */
  async identifiantsFavoris(partenaireId: number) {
    const favoris = await this.prisma.favoriCandidat.findMany({
      where: { partenaireId },
      select: { candidatId: true },
    });
    return favoris.map((favori) => favori.candidatId);
  }

  /* ------------------------------------------ Vitrine (administration) */

  /**
   * Toutes les fiches partenaires, pour la console.
   *
   * Les structures déjà en vitrine remontent en tête, dans leur ordre
   * d'affichage : la liste est aussi l'aperçu de ce que voit le visiteur, et
   * un administrateur qui réordonne doit voir le résultat sans faire défiler.
   */
  async listerPourAdministration() {
    return this.prisma.entreprisePartenaire.findMany({
      orderBy: [
        { estVisibleVitrine: 'desc' },
        { ordreVitrine: 'asc' },
        { nom: 'asc' },
      ],
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            isActive: true,
            _count: { select: { offres: true } },
          },
        },
      },
    });
  }

  /**
   * Met une structure en vitrine, ou l'en retire.
   *
   * Une fiche sans logo reste acceptée : la vitrine sait afficher un nom seul,
   * et refuser ici obligerait l'administration à relancer le partenaire avant
   * toute mise en avant.
   */
  async reglerVitrine(id: number, dto: VitrineDto) {
    const fiche = await this.prisma.entreprisePartenaire.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!fiche) throw new NotFoundException('Structure non trouvée');

    return this.prisma.entreprisePartenaire.update({
      where: { id },
      data: {
        ...(dto.estVisibleVitrine !== undefined && {
          estVisibleVitrine: dto.estVisibleVitrine,
        }),
        ...(dto.ordreVitrine !== undefined && { ordreVitrine: dto.ordreVitrine }),
      },
    });
  }

  /* --------------------------------------------------- Vitrine (public) */

  /** Structures mises en avant sur la page d'accueil. */
  async vitrine() {
    return this.prisma.entreprisePartenaire.findMany({
      where: { estVisibleVitrine: true },
      orderBy: [{ ordreVitrine: 'asc' }, { nom: 'asc' }],
      select: {
        id: true,
        nom: true,
        logoUrl: true,
        siteWeb: true,
        secteur: true,
        ville: true,
        description: true,
        // Ni téléphone ni email : la vitrine est publique, et ces coordonnées
        // deviendraient une cible de démarchage automatisé.
      },
    });
  }
}
