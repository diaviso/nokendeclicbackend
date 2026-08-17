import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CHAMPS_LEGACY, CreateOffreDto, UpdateOffreDto, OffresFilterDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { TypesOffresService } from '../types-offres/types-offres.service';

@Injectable()
export class OffresService {
  constructor(
    private prisma: PrismaService,
    private typesOffres: TypesOffresService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  /** Projection du type jointe à chaque offre : le front en a besoin pour
   *  l'affichage (libellé, icône, couleur) et pour rendre les champs. */
  private readonly typeSelect = {
    select: {
      id: true,
      code: true,
      libelle: true,
      icone: true,
      couleur: true,
      champs: {
        orderBy: { ordre: 'asc' as const },
        select: {
          id: true,
          code: true,
          libelle: true,
          type: true,
          obligatoire: true,
          options: true,
          aide: true,
          ordre: true,
        },
      },
    },
  };

  private readonly auteurSelect = {
    select: { id: true, username: true, pictureUrl: true },
  };

  /**
   * Met la réponse à la forme attendue par les deux frontends.
   *
   * `typeOffre` reste une **chaîne** (le code) : c'est ce que lisent l'ancien
   * front Vite — qui l'utilise comme clé de ses tables de libellés — et le
   * nouveau. Renvoyer l'objet sous ce nom ferait disparaître silencieusement
   * toutes les pastilles de type sur une application en production.
   *
   * L'objet complet (libellé, icône, couleur, définition des champs) est
   * exposé sous `type`, que seul le nouveau front consomme.
   *
   * Les anciennes colonnes spécifiques sont par ailleurs remontées à plat
   * depuis `champs`, pour que l'ancien front continue d'afficher salaire,
   * organisme ou pays de bourse. À retirer une fois l'ancien front déposé.
   */
  private serialiser<T extends Record<string, any>>(offre: T) {
    if (!offre) return offre;

    const { typeOffre, champs, ...reste } = offre;
    const valeurs = (champs ?? {}) as Record<string, unknown>;

    return {
      ...reste,
      ...valeurs,
      champs: valeurs,
      typeOffre: typeOffre?.code ?? null,
      type: typeOffre ?? null,
    };
  }

  /**
   * Résout le type et les valeurs de champs à partir d'une requête, qu'elle
   * vienne du nouveau front (`typeOffreId` + `champs`) ou de l'ancien
   * (`typeOffre` en code + champs spécifiques à plat).
   */
  private async resoudreEntree(
    dto: CreateOffreDto | UpdateOffreDto,
    typeParDefaut?: number,
  ) {
    let typeOffreId = dto.typeOffreId ?? typeParDefaut;

    if (!typeOffreId && dto.typeOffre) {
      const type = await this.prisma.typeOffre.findUnique({
        where: { code: dto.typeOffre.toUpperCase() },
        select: { id: true },
      });
      if (!type) {
        throw new NotFoundException(
          `Type d'offre « ${dto.typeOffre} » introuvable`,
        );
      }
      typeOffreId = type.id;
    }

    if (!typeOffreId) {
      throw new BadRequestException("Le type d'offre est requis");
    }

    // Champs hérités envoyés à plat : repliés dans `champs`, sans écraser une
    // valeur explicitement fournie sous la nouvelle forme.
    const heritees: Record<string, unknown> = {};
    const brut = dto as unknown as Record<string, unknown>;
    for (const code of CHAMPS_LEGACY) {
      const valeur = brut[code];
      if (valeur !== undefined && valeur !== null && valeur !== '') {
        heritees[code] = valeur;
      }
    }

    const champs = await this.typesOffres.validerValeurs(typeOffreId, {
      ...heritees,
      ...(dto.champs ?? {}),
    });

    return { typeOffreId, champs };
  }

  /** Retire du DTO les clés qui ne sont pas des colonnes de la table. */
  private sansClesNonColonnes(dto: CreateOffreDto | UpdateOffreDto) {
    const reste = { ...(dto as unknown as Record<string, unknown>) };

    for (const cle of ['champs', 'typeOffre', 'typeOffreId', 'dateLimite']) {
      delete reste[cle];
    }
    for (const code of CHAMPS_LEGACY) {
      delete reste[code];
    }

    return reste as Omit<
      CreateOffreDto,
      'champs' | 'typeOffre' | 'typeOffreId' | 'dateLimite'
    >;
  }

  async create(dto: CreateOffreDto, auteurId: number, auteurRole?: string) {
    // Les valeurs sont validées contre la définition du type : obligatoires
    // présents, types respectés, clés inconnues écartées.
    const { typeOffreId, champs } = await this.resoudreEntree(dto);
    const reste = this.sansClesNonColonnes(dto);
    const dateLimite = dto.dateLimite;

    // Une offre déposée par un partenaire attend une relecture ; celles de
    // l'administration entrent directement au catalogue. Le rôle est lu ici
    // plutôt que transmis par le client : c'est le serveur qui décide.
    const enAttente = auteurRole === 'PARTENAIRE';

    const offre = await this.prisma.offre.create({
      data: {
        ...reste,
        typeOffreId,
        typeEmploi: dto.typeEmploi as any,
        secteur: dto.secteur as any,
        niveauExperience: dto.niveauExperience as any,
        dateLimite: dateLimite ? new Date(dateLimite) : null,
        champs,
        auteurId,
        statutModeration: enAttente ? 'EN_ATTENTE' : 'PUBLIEE',
      } as any,
      include: { auteur: this.auteurSelect, typeOffre: this.typeSelect },
    });

    // Pas de notification tant que l'offre n'est pas visible : annoncer aux
    // membres une offre qu'ils ne peuvent pas ouvrir ne ferait qu'un lien mort.
    // Elle part à la validation (voir `moderer`).
    if (!enAttente) {
      await this.notificationsService.notifyNewOffre(offre.id, offre.titre);
    }

    return this.serialiser(offre);
  }

  /**
   * Tranche la modération d'une offre.
   *
   * Une offre refusée n'est pas supprimée : son auteur doit pouvoir lire le
   * motif, corriger et soumettre à nouveau. La notification aux membres part au
   * moment de la validation, et non du dépôt — c'est là que l'offre devient
   * réellement consultable.
   */
  async moderer(
    id: number,
    decision: { statut: 'PUBLIEE' | 'REFUSEE'; motif?: string },
    moderateurId: number,
  ) {
    const offre = await this.prisma.offre.findUnique({
      where: { id },
      select: { id: true, titre: true, statutModeration: true },
    });

    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    if (decision.statut === 'REFUSEE' && !decision.motif?.trim()) {
      throw new BadRequestException(
        'Un refus doit être motivé : le partenaire ne peut pas corriger sans savoir quoi.',
      );
    }

    const misAJour = await this.prisma.offre.update({
      where: { id },
      data: {
        statutModeration: decision.statut,
        motifRefus: decision.statut === 'REFUSEE' ? decision.motif?.trim() : null,
        dateModeration: new Date(),
        modereParId: moderateurId,
      },
      include: { auteur: this.auteurSelect, typeOffre: this.typeSelect },
    });

    // La notification ne part qu'à la première publication : revalider une
    // offre déjà passée au catalogue ne doit pas la réannoncer à tout le monde.
    if (
      decision.statut === 'PUBLIEE' &&
      offre.statutModeration !== 'PUBLIEE'
    ) {
      await this.notificationsService.notifyNewOffre(misAJour.id, misAJour.titre);
    }

    return this.serialiser(misAJour);
  }

  /** File d'attente de la console : les dépôts en attente, les plus anciens d'abord. */
  async findEnAttente() {
    const offres = await this.prisma.offre.findMany({
      where: { statutModeration: 'EN_ATTENTE' },
      // Les plus anciens d'abord : c'est celui qui attend depuis le plus
      // longtemps qui doit être traité en premier.
      orderBy: { createdAt: 'asc' },
      include: { auteur: this.auteurSelect, typeOffre: this.typeSelect },
    });

    return offres.map((offre) => this.serialiser(offre));
  }

  async findAll(filters: OffresFilterDto) {
    const { page = 1, limit = 20, ...filterParams } = filters;
    const skip = (page - 1) * limit;

    // Le catalogue ne montre que ce qui est validé. Le filtre est posé en
    // premier et n'est jamais surchargé par les paramètres de requête : c'est
    // la seule barrière entre un dépôt non relu et l'ensemble des membres.
    const where: any = { statutModeration: 'PUBLIEE' };

    // Le filtre accepte le code (liens partagés) ou l'identifiant.
    if (filterParams.typeOffreId) {
      where.typeOffreId = filterParams.typeOffreId;
    } else if (filterParams.typeOffre) {
      where.typeOffre = { code: filterParams.typeOffre.toUpperCase() };
    }

    if (filterParams.typeEmploi) where.typeEmploi = filterParams.typeEmploi;
    if (filterParams.secteur) where.secteur = filterParams.secteur;
    if (filterParams.niveauExperience) {
      where.niveauExperience = filterParams.niveauExperience;
    }
    if (filterParams.localisation) {
      where.localisation = {
        contains: filterParams.localisation,
        mode: 'insensitive',
      };
    }
    if (filterParams.tag) where.tags = { has: filterParams.tag };
    if (filterParams.keyword) {
      where.OR = [
        { titre: { contains: filterParams.keyword, mode: 'insensitive' } },
        { description: { contains: filterParams.keyword, mode: 'insensitive' } },
        { entreprise: { contains: filterParams.keyword, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.offre.findMany({
        where,
        skip,
        take: limit,
        orderBy: { datePublication: 'desc' },
        include: {
          auteur: this.auteurSelect,
          typeOffre: this.typeSelect,
          _count: { select: { commentaires: true, retours: true, likes: true } },
        },
      }),
      this.prisma.offre.count({ where }),
    ]);

    return {
      data: data.map((offre) => this.serialiser(offre)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + data.length < total,
    };
  }

  async findById(id: number) {
    const offre = await this.prisma.offre.findUnique({
      where: { id },
      include: {
        // Pas d'email : cette route est publique (rendu serveur des pages
        // d'offres). L'adresse de l'auteur reste accessible aux administrateurs
        // via GET /api/admin/offres/:id.
        auteur: this.auteurSelect,
        typeOffre: this.typeSelect,
        commentaires: {
          include: {
            auteur: { select: { id: true, username: true, pictureUrl: true } },
          },
          orderBy: { datePublication: 'desc' },
        },
        fichiers: { orderBy: { createdAt: 'desc' } },
        _count: { select: { commentaires: true, retours: true, likes: true } },
      },
    });

    // Une offre non validée n'existe pas pour le public : renvoyer 403 plutôt
    // que 404 confirmerait son existence, et l'adresse d'un dépôt en attente
    // suffirait alors à contourner la relecture en la partageant.
    if (!offre || offre.statutModeration !== 'PUBLIEE') {
      throw new NotFoundException('Offre non trouvée');
    }

    await this.prisma.offre.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    return this.serialiser(offre);
  }

  /**
   * Offre telle que son auteur ou l'administration doit la voir, quel que soit
   * son état de modération — c'est ce que charge le formulaire de modification.
   *
   * Distincte de `findById`, qui sert le catalogue public : celle-ci exige une
   * session, ne compte pas de vue, et laisse passer les dépôts en attente.
   */
  async findPourEdition(id: number, userId: number, userRole: string) {
    const offre = await this.prisma.offre.findUnique({
      where: { id },
      include: {
        auteur: this.auteurSelect,
        typeOffre: this.typeSelect,
        fichiers: { orderBy: { createdAt: 'desc' as const } },
      },
    });

    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    if (offre.auteurId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas consulter cette offre');
    }

    return this.serialiser(offre);
  }

  async update(id: number, dto: UpdateOffreDto, userId: number, userRole: string) {
    const offre = await this.prisma.offre.findUnique({ where: { id } });

    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    if (offre.auteurId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas modifier cette offre');
    }

    // Le type peut changer : les valeurs sont revalidées contre la définition
    // du type cible, ce qui écarte au passage les champs de l'ancien type.
    const { typeOffreId, champs } = await this.resoudreEntree(
      {
        ...dto,
        // Sans valeurs fournies, on repart de celles déjà enregistrées : une
        // mise à jour partielle ne doit pas vider les champs du type.
        champs: dto.champs ?? (offre.champs as Record<string, unknown>),
      },
      offre.typeOffreId,
    );

    const reste = this.sansClesNonColonnes(dto);
    const dateLimite = dto.dateLimite;

    // Une modification par un partenaire renvoie l'offre en relecture. Sans
    // cela, la modération se contourne en une manœuvre : déposer une annonce
    // inoffensive, attendre sa validation, puis la réécrire entièrement. Une
    // modification par l'administration ne change évidemment rien.
    const repasseEnRelecture = userRole !== 'ADMIN';

    const misAJour = await this.prisma.offre.update({
      where: { id },
      data: {
        ...reste,
        typeOffreId,
        typeEmploi: dto.typeEmploi as any,
        secteur: dto.secteur as any,
        niveauExperience: dto.niveauExperience as any,
        dateLimite: dateLimite ? new Date(dateLimite) : null,
        champs,
        ...(repasseEnRelecture
          ? {
              statutModeration: 'EN_ATTENTE' as const,
              motifRefus: null,
              dateModeration: null,
              modereParId: null,
            }
          : {}),
      },
      include: { auteur: this.auteurSelect, typeOffre: this.typeSelect },
    });

    return this.serialiser(misAJour);
  }

  /**
   * Met à jour la photo de couverture ou le document principal.
   *
   * `userId` est optionnel : les appels internes (création avec document, où
   * l'appartenance vient d'être établie) le laissent de côté, les endpoints
   * exposés le fournissent pour que l'autorisation soit vérifiée ici plutôt
   * que dupliquée dans le contrôleur.
   */
  async updateMedia(
    id: number,
    data: {
      imageUrl?: string | null;
      documentUrl?: string | null;
      documentName?: string | null;
      documentType?: string | null;
    },
    auteur?: { userId: number; userRole: string },
  ) {
    if (auteur) {
      const offre = await this.prisma.offre.findUnique({
        where: { id },
        select: { auteurId: true },
      });
      if (!offre) throw new NotFoundException('Offre non trouvée');
      if (offre.auteurId !== auteur.userId && auteur.userRole !== 'ADMIN') {
        throw new ForbiddenException('Vous ne pouvez pas modifier cette offre');
      }
    }

    return this.prisma.offre.update({ where: { id }, data });
  }

  async delete(id: number, userId: number, userRole: string) {
    const offre = await this.prisma.offre.findUnique({ where: { id } });

    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    if (offre.auteurId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas supprimer cette offre');
    }

    await this.prisma.offre.delete({ where: { id } });
    return { message: 'Offre supprimée avec succès' };
  }

  /**
   * Référentiel des valeurs proposées dans les formulaires.
   * Les types viennent désormais de la base ; les autres restent des
   * énumérations du schéma.
   */
  async getTypes() {
    const typeOffre = await this.prisma.typeOffre.findMany({
      where: { estActif: true },
      orderBy: [{ ordre: 'asc' }, { libelle: 'asc' }],
      select: { id: true, code: true, libelle: true, icone: true, couleur: true },
    });

    return {
      typeOffre,
      typeEmploi: [
        'CDI', 'CDD', 'STAGE', 'ALTERNANCE', 'FREELANCE', 'INTERIM',
        'SAISONNIER', 'TEMPS_PARTIEL', 'TEMPS_PLEIN',
      ],
      secteur: [
        'INFORMATIQUE', 'FINANCE', 'SANTE', 'EDUCATION', 'COMMERCE', 'INDUSTRIE',
        'AGRICULTURE', 'TOURISME', 'TRANSPORT', 'COMMUNICATION', 'ADMINISTRATION',
        'ARTISANAT', 'CONSTRUCTION', 'ENERGIE', 'ENVIRONNEMENT', 'JURIDIQUE',
        'MARKETING', 'RESSOURCES_HUMAINES', 'RECHERCHE', 'AUTRE',
      ],
      niveauExperience: ['DEBUTANT', 'JUNIOR', 'CONFIRME', 'SENIOR', 'EXPERT'],
    };
  }

  /**
   * Les comptages n'incluent que les offres validées : ils alimentent la page
   * d'accueil et les compteurs par catégorie, qui doivent correspondre à ce
   * qu'un visiteur trouvera réellement en cliquant.
   */
  async count() {
    return this.prisma.offre.count({ where: { statutModeration: 'PUBLIEE' } });
  }

  /** Comptage par type — dérivé de la table, plus d'une liste figée. */
  async countByType() {
    const groupes = await this.prisma.offre.groupBy({
      by: ['typeOffreId'],
      where: { statutModeration: 'PUBLIEE' },
      _count: { typeOffreId: true },
    });

    const types = await this.prisma.typeOffre.findMany({
      select: { id: true, code: true, libelle: true },
    });

    return types.map((type) => ({
      id: type.id,
      code: type.code,
      libelle: type.libelle,
      count:
        groupes.find((g) => g.typeOffreId === type.id)?._count.typeOffreId ?? 0,
    }));
  }

  async countBySecteur() {
    return this.prisma.offre.groupBy({
      by: ['secteur'],
      where: { statutModeration: 'PUBLIEE' },
      _count: { secteur: true },
    });
  }

  async getTopOffres(limit = 5) {
    return this.prisma.offre.findMany({
      where: { statutModeration: 'PUBLIEE' },
      take: limit,
      orderBy: { retours: { _count: 'desc' } },
      include: {
        auteur: { select: { id: true, username: true } },
        typeOffre: { select: { code: true, libelle: true } },
        _count: { select: { retours: true } },
      },
    });
  }

  async findByAuteur(auteurId: number) {
    const offres = await this.prisma.offre.findMany({
      where: { auteurId },
      orderBy: { datePublication: 'desc' },
      include: {
        typeOffre: this.typeSelect,
        _count: { select: { commentaires: true, retours: true, likes: true } },
      },
    });

    return offres.map((offre) => this.serialiser(offre));
  }
}
