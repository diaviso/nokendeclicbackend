import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { reparerNomFichier, StorageService } from '../storage/storage.service';
import type {
  DeposerMediaDto,
  ListeMediasDto,
  ModifierMediaDto,
} from './dto/media.dto';

/** Celui qui fait la demande, tel que lu dans le jeton. */
export interface Demandeur {
  id: number;
  role?: string | null;
}

/** Ce qu'il faut d'une image pour en faire une couverture. */
export interface CouvertureChoisie {
  id: number;
  url: string;
  alt: string | null;
}

const DOSSIER = 'medias';
export const TYPES_IMAGES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Plus grand côté conservé. Une couverture s'affiche au mieux sur 1 200 px de
 * large ; 1 600 laisse de la marge aux écrans denses, sans garder les 4 000 px
 * d'une photo de téléphone qu'aucun écran n'affichera.
 */
const COTE_MAX = 1600;

const SELECTION = {
  id: true,
  url: true,
  nom: true,
  alt: true,
  largeur: true,
  hauteur: true,
  taille: true,
  typeMime: true,
  commune: true,
  createdAt: true,
  auteurId: true,
  auteur: { select: { firstName: true, lastName: true, username: true } },
  _count: { select: { offres: true } },
} satisfies Prisma.MediaSelect;

type MediaBrut = Prisma.MediaGetPayload<{ select: typeof SELECTION }>;

const estAdmin = (demandeur: Demandeur) => demandeur.role === 'ADMIN';

function empreinteDe(octets: Buffer): string {
  return createHash('sha256').update(octets).digest('hex');
}

/** « photo_bourse-2026.jpg » → « photo bourse 2026 ». */
function nomDepuisFichier(nomFichier?: string): string {
  const sansExtension = (nomFichier ?? '').replace(/\.[^.]+$/, '');
  const lisible = sansExtension.replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ');
  return lisible.trim().slice(0, 120) || 'Image';
}

function typeMimeDe(format?: string): string | null {
  switch (format) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return format ? `image/${format}` : null;
  }
}

/**
 * Médiathèque : les images de couverture, réutilisables d'une offre à l'autre.
 *
 * Trois règles la gouvernent :
 * - un même fichier n'est stocké qu'une fois — un second envoi renvoie l'image
 *   déjà connue ;
 * - toute image est recompressée à l'envoi : redimensionnée, débarrassée de
 *   ses métadonnées (dont la position GPS que glissent les téléphones) ;
 * - une image ne quitte le stockage que retirée explicitement, et jamais tant
 *   qu'une offre l'affiche.
 */
@Injectable()
export class MediasService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MediasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /* --------------------------------------------------------- visibilité -- */

  /**
   * L'administration voit toute la médiathèque ; un partenaire, ses propres
   * images et la banque commune.
   */
  private visibles(demandeur: Demandeur): Prisma.MediaWhereInput {
    if (estAdmin(demandeur)) return {};
    return { OR: [{ auteurId: demandeur.id }, { commune: true }] };
  }

  private peutModifier(
    demandeur: Demandeur,
    media: { auteurId: number | null },
  ): boolean {
    return estAdmin(demandeur) || media.auteurId === demandeur.id;
  }

  private serialiser(media: MediaBrut, demandeur: Demandeur) {
    const { _count, auteur, ...reste } = media;
    return {
      ...reste,
      utilisations: _count.offres,
      auteur: auteur
        ? [auteur.firstName, auteur.lastName].filter(Boolean).join(' ') ||
          auteur.username
        : null,
      modifiable: this.peutModifier(demandeur, media),
    };
  }

  /* ------------------------------------------------------------ lecture -- */

  async lister(demandeur: Demandeur, filtres: ListeMediasDto) {
    const page = filtres.page ?? 1;
    const limite = filtres.limite ?? 24;
    const conditions: Prisma.MediaWhereInput[] = [this.visibles(demandeur)];

    if (filtres.q) {
      const contient = { contains: filtres.q, mode: 'insensitive' as const };
      conditions.push({
        OR: [
          { nom: contient },
          { alt: contient },
          // Retrouver une image par l'offre qui l'affiche : « bourse »
          // ramène les visuels déjà utilisés pour des bourses.
          { offres: { some: { titre: contient } } },
        ],
      });
    }

    switch (filtres.filtre) {
      case 'miennes':
        conditions.push({ auteurId: demandeur.id });
        break;
      case 'inutilisees':
        conditions.push({ offres: { none: {} } });
        break;
      case 'communes':
        conditions.push({ commune: true });
        break;
    }

    const where: Prisma.MediaWhereInput = { AND: conditions };
    const orderBy: Prisma.MediaOrderByWithRelationInput[] =
      filtres.tri === 'utilisees'
        ? [
            { offres: { _count: 'desc' } },
            { createdAt: 'desc' },
            { id: 'desc' },
          ]
        : [{ createdAt: 'desc' }, { id: 'desc' }];

    const [total, medias] = await Promise.all([
      this.prisma.media.count({ where }),
      this.prisma.media.findMany({
        where,
        orderBy,
        skip: (page - 1) * limite,
        take: limite,
        select: SELECTION,
      }),
    ]);

    return {
      elements: medias.map((media) => this.serialiser(media, demandeur)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limite)),
    };
  }

  /** Repères de la page de gestion : volume, et ce qu'on pourrait libérer. */
  async bilan(demandeur: Demandeur) {
    const visibles = this.visibles(demandeur);
    const [tout, libres, communes] = await Promise.all([
      this.prisma.media.aggregate({
        where: visibles,
        _count: { _all: true },
        _sum: { taille: true },
      }),
      this.prisma.media.aggregate({
        where: { AND: [visibles, { offres: { none: {} } }] },
        _count: { _all: true },
        _sum: { taille: true },
      }),
      this.prisma.media.count({
        where: { AND: [visibles, { commune: true }] },
      }),
    ]);
    return {
      total: tout._count._all,
      poids: tout._sum.taille ?? 0,
      inutilisees: libres._count._all,
      poidsInutilisees: libres._sum.taille ?? 0,
      communes,
    };
  }

  /**
   * Image choisie comme couverture, après vérification que le demandeur y a
   * accès : un partenaire ne peut pas afficher l'image privée d'un autre en
   * devinant son identifiant.
   */
  async pourOffre(
    id: number,
    demandeur: Demandeur,
  ): Promise<CouvertureChoisie> {
    const media = await this.prisma.media.findFirst({
      where: { AND: [{ id }, this.visibles(demandeur)] },
      select: { id: true, url: true, alt: true },
    });
    if (!media) {
      throw new NotFoundException('Image introuvable dans votre médiathèque');
    }
    return media;
  }

  /* -------------------------------------------------------------- envoi -- */

  async deposer(
    fichier: Express.Multer.File | undefined,
    demandeur: Demandeur,
    options: DeposerMediaDto = {},
  ) {
    if (!fichier?.buffer?.length) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    if (!TYPES_IMAGES.includes(fichier.mimetype)) {
      throw new BadRequestException(
        'La couverture doit être une image JPEG, PNG ou WebP',
      );
    }

    // Même fichier, même empreinte : on rend l'image déjà en médiathèque au
    // lieu d'en stocker une copie. La recherche se limite à ce que le
    // demandeur peut voir — sinon un partenaire découvrirait, en renvoyant un
    // fichier, l'image privée d'un autre.
    const empreinte = empreinteDe(fichier.buffer);
    const existante = await this.prisma.media.findFirst({
      where: { AND: [{ empreinte }, this.visibles(demandeur)] },
      orderBy: { id: 'asc' },
      select: SELECTION,
    });
    if (existante) {
      if (!existante.alt && options.alt) {
        await this.prisma.media.update({
          where: { id: existante.id },
          data: { alt: options.alt },
        });
        existante.alt = options.alt;
      }
      return {
        media: this.serialiser(existante, demandeur),
        existait: true,
        tailleEnvoyee: fichier.size,
      };
    }

    const { octets, largeur, hauteur, typeMime, extension } =
      await this.preparer(fichier.buffer);

    const stocke = await this.storage.deposerOctets({
      dossier: DOSSIER,
      extension,
      octets,
      typeMime,
      nomOrigine: reparerNomFichier(fichier.originalname),
    });

    let media: MediaBrut;
    try {
      media = await this.prisma.media.create({
        data: {
          cle: stocke.key,
          url: stocke.url,
          empreinte,
          nom:
            options.nom ??
            nomDepuisFichier(reparerNomFichier(fichier.originalname)),
          alt: options.alt ?? null,
          largeur,
          hauteur,
          taille: octets.length,
          typeMime,
          auteurId: demandeur.id,
        },
        select: SELECTION,
      });
    } catch (erreur) {
      // L'objet vient d'être créé et rien ne le référence : le laisser,
      // c'est un fichier perdu dans le bucket.
      await this.storage.delete(stocke.key);
      throw erreur;
    }

    this.logger.log(
      `Image « ${media.nom} » déposée par ${demandeur.id} : ` +
        `${Math.round(fichier.size / 1024)} Ko → ${Math.round(octets.length / 1024)} Ko`,
    );

    return {
      media: this.serialiser(media, demandeur),
      existait: false,
      tailleEnvoyee: fichier.size,
    };
  }

  /**
   * Redimensionne et recompresse.
   *
   * JPEG plutôt que WebP : la couverture sert d'aperçu quand une offre est
   * partagée, et WhatsApp comme certains réseaux lisent mal le WebP. Une image
   * qui a besoin de sa transparence (un logo détouré) reste en PNG — en JPEG,
   * le fond deviendrait noir.
   */
  private async preparer(source: Buffer) {
    let opaque: boolean;
    try {
      const metadonnees = await sharp(source).metadata();
      if (!metadonnees.width || !metadonnees.height) throw new Error('vide');
      opaque = metadonnees.hasAlpha
        ? (await sharp(source).stats()).isOpaque
        : true;
    } catch {
      throw new BadRequestException(
        'Image illisible ou endommagée. Essayez un autre fichier.',
      );
    }

    // `rotate()` sans argument applique l'orientation EXIF, puis la sortie
    // perd toutes les métadonnées : une photo prise couchée s'affiche droite,
    // et sans la position GPS du téléphone.
    const base = sharp(source).rotate().resize({
      width: COTE_MAX,
      height: COTE_MAX,
      fit: 'inside',
      withoutEnlargement: true,
    });

    const { data, info } = opaque
      ? await base
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 82, mozjpeg: true })
          .toBuffer({ resolveWithObject: true })
      : await base
          .png({ compressionLevel: 9, palette: true, quality: 90, effort: 8 })
          .toBuffer({ resolveWithObject: true });

    return {
      octets: data,
      largeur: info.width,
      hauteur: info.height,
      typeMime: opaque ? 'image/jpeg' : 'image/png',
      extension: opaque ? '.jpg' : '.png',
    };
  }

  /* ------------------------------------------------------- modification -- */

  async modifier(id: number, demandeur: Demandeur, dto: ModifierMediaDto) {
    const media = await this.prisma.media.findUnique({
      where: { id },
      select: { auteurId: true },
    });
    if (!media) throw new NotFoundException('Image introuvable');
    if (!this.peutModifier(demandeur, media)) {
      throw new ForbiddenException('Vous ne pouvez pas modifier cette image');
    }
    if (dto.commune !== undefined && !estAdmin(demandeur)) {
      throw new ForbiddenException(
        "Seule l'administration choisit les images communes",
      );
    }
    if (dto.nom !== undefined && !dto.nom) {
      throw new BadRequestException("Le nom de l'image ne peut pas être vide");
    }

    const misAJour = await this.prisma.media.update({
      where: { id },
      data: {
        ...(dto.nom !== undefined ? { nom: dto.nom } : {}),
        ...(dto.alt !== undefined ? { alt: dto.alt || null } : {}),
        ...(dto.commune !== undefined ? { commune: dto.commune } : {}),
      },
      select: SELECTION,
    });
    return this.serialiser(misAJour, demandeur);
  }

  /**
   * Retire une image de la médiathèque et du stockage — jamais si une offre
   * l'affiche encore, que ce soit en couverture ou dans le corps du texte.
   */
  async supprimer(id: number, demandeur: Demandeur) {
    const media = await this.prisma.media.findUnique({
      where: { id },
      select: { id: true, cle: true, url: true, nom: true, auteurId: true },
    });
    if (!media) throw new NotFoundException('Image introuvable');
    if (!this.peutModifier(demandeur, media)) {
      throw new ForbiddenException('Vous ne pouvez pas supprimer cette image');
    }

    const utilisatrices: Prisma.OffreWhereInput = {
      OR: [
        { imageId: media.id },
        { imageUrl: media.url },
        { contenuHtml: { contains: media.cle } },
      ],
    };
    const [nombre, exemples] = await Promise.all([
      this.prisma.offre.count({ where: utilisatrices }),
      this.prisma.offre.findMany({
        where: utilisatrices,
        select: { titre: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);
    if (nombre > 0) {
      const titres = exemples.map((offre) => `« ${offre.titre} »`).join(', ');
      throw new ConflictException(
        `Image utilisée par ${nombre} offre${nombre > 1 ? 's' : ''} : ${titres}` +
          `${nombre > exemples.length ? '…' : ''}. Changez leur couverture avant de la supprimer.`,
      );
    }

    await this.prisma.media.delete({ where: { id } });
    await this.storage.delete(media.cle);
    this.logger.log(
      `Image « ${media.nom} » (${media.cle}) supprimée par ${demandeur.id}`,
    );
    return { message: 'Image supprimée' };
  }

  /* ------------------------------------------------- reprise de l'existant */

  onApplicationBootstrap() {
    if (!this.storage.isConfigured) return;
    // En arrière-plan : ni le démarrage ni la sonde de santé de Railway
    // n'attendent la lecture des images dans le bucket.
    setTimeout(() => {
      this.reprendreExistant().catch((erreur) =>
        this.logger.error(
          'Reprise de la médiathèque interrompue',
          erreur instanceof Error ? erreur.stack : String(erreur),
        ),
      );
    }, 5_000).unref();
  }

  /**
   * Complète la médiathèque à partir de ce qui existait avant elle. Chaque
   * étape est idempotente : relancée à chaque démarrage, elle ne fait plus
   * rien une fois le travail accompli.
   *
   * 1. Les couvertures restées dans le bucket sans offre y entrent, pour
   *    qu'on puisse les réutiliser ou les supprimer.
   * 2. Les images reprises par la migration reçoivent leur empreinte et leurs
   *    dimensions, lues dans le fichier lui-même.
   * 3. Les offres qui affichent le même fichier, envoyé plusieurs fois,
   *    pointent désormais vers un seul exemplaire. Les autres deviennent
   *    « non utilisés » : l'administration peut alors les supprimer.
   */
  async reprendreExistant() {
    const bilan = { ajoutees: 0, completees: 0, illisibles: 0, regroupees: 0 };

    // 1. Couvertures sans offre.
    const objets = await this.storage.lister('couvertures/');
    if (objets.length) {
      const connues = new Set(
        (
          await this.prisma.media.findMany({
            where: { cle: { in: objets.map((objet) => objet.key) } },
            select: { cle: true },
          })
        ).map((media) => media.cle),
      );
      for (const objet of objets.filter((o) => !connues.has(o.key))) {
        const url = this.storage.urlFor(objet.key);
        const nomOrigine = await this.storage
          .nomOrigine(objet.key)
          .catch(() => null);
        const media = await this.prisma.media.create({
          data: {
            cle: objet.key,
            url,
            nom: nomOrigine
              ? nomDepuisFichier(reparerNomFichier(nomOrigine))
              : 'Couverture sans offre',
            taille: objet.size,
          },
        });
        await this.prisma.offre.updateMany({
          where: { imageUrl: url, imageId: null },
          data: { imageId: media.id },
        });
        bilan.ajoutees += 1;
      }
    }

    // 2. Empreintes et dimensions manquantes.
    const aCompleter = await this.prisma.media.findMany({
      where: { empreinte: null },
      select: { id: true, cle: true },
      take: 200,
    });
    for (const media of aCompleter) {
      try {
        const octets = await this.storage.lire(media.cle);
        const metadonnees = await sharp(octets).metadata();
        await this.prisma.media.update({
          where: { id: media.id },
          data: {
            empreinte: empreinteDe(octets),
            largeur: metadonnees.width ?? null,
            hauteur: metadonnees.height ?? null,
            taille: octets.length,
            typeMime: typeMimeDe(metadonnees.format),
          },
        });
        bilan.completees += 1;
      } catch {
        bilan.illisibles += 1;
      }
    }

    // 3. Doublons exacts. Le regroupement reste dans un même périmètre de
    //    visibilité : les images de l'administration entre elles, celles d'un
    //    partenaire entre elles — une offre de partenaire ne doit pas finir
    //    par pointer vers une image qu'il ne voit pas.
    const groupes = await this.prisma.media.groupBy({
      by: ['empreinte'],
      where: { empreinte: { not: null } },
      _count: { _all: true },
      having: { empreinte: { _count: { gt: 1 } } },
    });
    for (const groupe of groupes) {
      const exemplaires = await this.prisma.media.findMany({
        where: { empreinte: groupe.empreinte },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          url: true,
          auteurId: true,
          auteur: { select: { role: true } },
        },
      });
      const parPerimetre = new Map<string, typeof exemplaires>();
      for (const exemplaire of exemplaires) {
        const perimetre =
          !exemplaire.auteur || exemplaire.auteur.role === 'ADMIN'
            ? 'administration'
            : `partenaire:${exemplaire.auteurId}`;
        parPerimetre.set(perimetre, [
          ...(parPerimetre.get(perimetre) ?? []),
          exemplaire,
        ]);
      }
      for (const [canonique, ...copies] of parPerimetre.values()) {
        if (!copies.length) continue;
        const { count } = await this.prisma.offre.updateMany({
          where: { imageId: { in: copies.map((copie) => copie.id) } },
          data: { imageId: canonique.id, imageUrl: canonique.url },
        });
        bilan.regroupees += count;
      }
    }

    if (
      bilan.ajoutees ||
      bilan.completees ||
      bilan.illisibles ||
      bilan.regroupees
    ) {
      this.logger.log(
        `Reprise de la médiathèque : ${bilan.ajoutees} couverture(s) sans offre ajoutée(s), ` +
          `${bilan.completees} empreinte(s) calculée(s), ${bilan.illisibles} fichier(s) illisible(s), ` +
          `${bilan.regroupees} offre(s) regroupée(s) sur un exemplaire unique`,
      );
    }
    return bilan;
  }
}
