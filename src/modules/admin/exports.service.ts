import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Workbook, type CellValue, type Worksheet } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { THEMES, themesDe } from '../agents-ia/agents-ia.service';
import { AdminService } from './admin.service';

const JOUR = 86_400_000;

/* ----------------------------------------------------------- formats ----- */

const DATE = 'dd/mm/yyyy';
const DATE_HEURE = 'dd/mm/yyyy hh:mm';
const MOIS = 'mmmm yyyy';
const ENTIER = '#,##0';
const POURCENT = '0.0%';

/** Bleu de marque de Noken, pour les en-têtes. */
const BLEU = 'FF0090FF';

/* ---------------------------------------------------------- libellés ----- */

// Les mêmes mots que l'interface : un tableau exporté doit se lire comme la
// console, sans codes internes à déchiffrer.
const ROLES: Record<string, string> = {
  ADMIN: 'Administrateur',
  PARTENAIRE: 'Partenaire',
  MEMBRE: 'Membre',
};
const STATUTS_PRO: Record<string, string> = {
  NON_PRECISE: 'Non précisé',
  EN_RECHERCHE: 'En recherche',
  EN_POSTE: 'En poste',
  ETUDIANT: 'Étudiant',
  FREELANCE: 'Freelance',
  CHOMAGE: 'Sans emploi',
  RECONVERSION: 'En reconversion',
};
const SEXES: Record<string, string> = {
  HOMME: 'Homme',
  FEMME: 'Femme',
  AUTRE: 'Autre',
  NON_PRECISE: 'Non précisé',
};
const SECTEURS: Record<string, string> = {
  INFORMATIQUE: 'Informatique',
  FINANCE: 'Finance',
  SANTE: 'Santé',
  EDUCATION: 'Éducation',
  COMMERCE: 'Commerce',
  INDUSTRIE: 'Industrie',
  AGRICULTURE: 'Agriculture',
  TOURISME: 'Tourisme',
  TRANSPORT: 'Transport',
  COMMUNICATION: 'Communication',
  ADMINISTRATION: 'Administration',
  ARTISANAT: 'Artisanat',
  CONSTRUCTION: 'Construction',
  ENERGIE: 'Énergie',
  ENVIRONNEMENT: 'Environnement',
  JURIDIQUE: 'Juridique',
  MARKETING: 'Marketing',
  RESSOURCES_HUMAINES: 'Ressources humaines',
  RECHERCHE: 'Recherche',
  AUTRE: 'Autre',
};
const NIVEAUX: Record<string, string> = {
  DEBUTANT: 'Débutant',
  JUNIOR: 'Junior',
  CONFIRME: 'Confirmé',
  SENIOR: 'Senior',
  EXPERT: 'Expert',
};
const CONTRATS: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  STAGE: 'Stage',
  ALTERNANCE: 'Alternance',
  FREELANCE: 'Freelance',
  INTERIM: 'Intérim',
  SAISONNIER: 'Saisonnier',
  TEMPS_PARTIEL: 'Temps partiel',
  TEMPS_PLEIN: 'Temps plein',
};
const MODERATION: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  PUBLIEE: 'Publiée',
  REFUSEE: 'Refusée',
};
const AGES: Record<string, string> = {
  '0-17': 'Moins de 18 ans',
  '18-25': '18–25 ans',
  '26-35': '26–35 ans',
  '36-45': '36–45 ans',
  '46-55': '46–55 ans',
  '56-65': '56–65 ans',
  '65+': 'Plus de 65 ans',
  'Non précisé': 'Non renseigné',
};

const LIBELLES_THEMES = new Map(
  THEMES.map((theme) => [theme.cle, theme.libelle]),
);

/** Réponse de repli de l'assistant, quand il n'a rien pu produire. */
const REPLI = /^d[ée]sol[ée],? je n['’]ai pas pu g[ée]n[ée]rer une r[ée]ponse/i;

const NON_RENSEIGNE = 'Non renseigné';

function libelle(
  carte: Record<string, string>,
  valeur?: string | null,
): string {
  if (!valeur) return NON_RENSEIGNE;
  return carte[valeur] ?? valeur;
}

function ouiNon(valeur: boolean | null | undefined): string {
  return valeur ? 'Oui' : 'Non';
}

function nomComplet(personne: {
  firstName?: string | null;
  lastName?: string | null;
  username: string;
}): string {
  return (
    [personne.firstName, personne.lastName].filter(Boolean).join(' ') ||
    personne.username
  );
}

function ageDe(naissance: Date | null, maintenant: Date): number | null {
  if (!naissance) return null;
  return Math.floor(
    (maintenant.getTime() - naissance.getTime()) / (365.25 * JOUR),
  );
}

/** Mêmes bornes que la page Statistiques, pour que les deux se recoupent. */
function trancheAge(age: number | null): string {
  if (age === null) return NON_RENSEIGNE;
  if (age < 18) return AGES['0-17'];
  if (age <= 25) return AGES['18-25'];
  if (age <= 35) return AGES['26-35'];
  if (age <= 45) return AGES['36-45'];
  if (age <= 55) return AGES['46-55'];
  if (age <= 65) return AGES['56-65'];
  return AGES['65+'];
}

/** Le Markdown de l'assistant, lisible dans une cellule. */
function texteSimple(markdown: string): string {
  return markdown
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)');
}

/* ------------------------------------------------------- mise en page ---- */

interface Colonne<T> {
  entete: string;
  largeur: number;
  valeur: (ligne: T) => CellValue;
  format?: string;
  /** Texte long : retour à la ligne dans la cellule. */
  long?: boolean;
}

function styliserEntete(feuille: Worksheet) {
  const entete = feuille.getRow(1);
  entete.height = 22;
  entete.eachCell((cellule) => {
    cellule.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cellule.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BLEU },
    };
    cellule.alignment = { vertical: 'middle' };
  });
}

/**
 * Feuille tabulaire : en-tête figé et filtrable, colonnes typées.
 *
 * Les filtres sont posés d'office : c'est le premier geste de qui ouvre un
 * export, et le proposer évite de le reconstruire à chaque fois.
 */
function feuilleTableau<T>(
  classeur: Workbook,
  nom: string,
  colonnes: Colonne<T>[],
  lignes: T[],
): Worksheet {
  const feuille = classeur.addWorksheet(nom, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  feuille.columns = colonnes.map((colonne) => ({
    header: colonne.entete,
    width: colonne.largeur,
  }));
  for (const ligne of lignes) {
    feuille.addRow(colonnes.map((colonne) => colonne.valeur(ligne) ?? null));
  }
  colonnes.forEach((colonne, index) => {
    const cible = feuille.getColumn(index + 1);
    if (colonne.format) cible.numFmt = colonne.format;
    if (colonne.long) cible.alignment = { wrapText: true, vertical: 'top' };
  });
  styliserEntete(feuille);
  feuille.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colonnes.length },
  };
  return feuille;
}

/**
 * Répartition d'un effectif : catégorie, effectif, part, puis un total.
 *
 * La part est rangée comme une fraction au format pourcentage : Excel la
 * traite alors comme un nombre, et on peut en refaire la somme.
 */
function feuilleRepartition(
  classeur: Workbook,
  nom: string,
  categorie: string,
  lignes: { categorie: string; effectif: number }[],
  trier = true,
): Worksheet {
  const total = lignes.reduce((somme, ligne) => somme + ligne.effectif, 0);
  const ordonnees = trier
    ? [...lignes].sort((a, b) => b.effectif - a.effectif)
    : lignes;
  const feuille = feuilleTableau(
    classeur,
    nom,
    [
      { entete: categorie, largeur: 36, valeur: (l) => l.categorie },
      {
        entete: 'Effectif',
        largeur: 12,
        valeur: (l) => l.effectif,
        format: ENTIER,
      },
      {
        entete: 'Part',
        largeur: 10,
        valeur: (l) => (total > 0 ? l.effectif / total : 0),
        format: POURCENT,
      },
    ],
    ordonnees,
  );
  const ligneTotal = feuille.addRow(['Total', total, total > 0 ? 1 : 0]);
  ligneTotal.font = { bold: true };
  return feuille;
}

/**
 * Exports Excel de la console.
 *
 * Chaque classeur s'ouvre sur une feuille « À propos » : ce qu'il contient, à
 * quelle date, et — quand il porte des données personnelles — ce qu'on a le
 * droit d'en faire. Un fichier circule ; il doit pouvoir se comprendre seul.
 */
@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
    private readonly config: ConfigService,
  ) {}

  /* ------------------------------------------------------ utilisateurs -- */

  async utilisateurs(): Promise<Workbook> {
    const maintenant = new Date();
    const [comptes, questions] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        // Projection explicite : jamais le hachage du mot de passe ni le jeton
        // de rafraîchissement dans un fichier qui quitte le serveur.
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          email: true,
          telephone: true,
          role: true,
          isActive: true,
          isEmailVerified: true,
          isGoogleLogin: true,
          statutProfessionnel: true,
          sexe: true,
          dateNaissance: true,
          region: true,
          departement: true,
          commune: true,
          handicap: true,
          createdAt: true,
          cguAccepteeLe: true,
          cv: { select: { estPublic: true } },
          _count: {
            select: {
              favorites: true,
              likes: true,
              commentaires: true,
              retours: true,
              offres: true,
            },
          },
        },
      }),
      this.prisma.chatMessage.findMany({
        where: { role: 'user' },
        select: { conversation: { select: { userId: true } } },
      }),
    ]);

    const questionsDe = new Map<number, number>();
    for (const question of questions) {
      const id = question.conversation.userId;
      questionsDe.set(id, (questionsDe.get(id) ?? 0) + 1);
    }

    const classeur = this.nouveauClasseur();
    this.feuilleApropos(classeur, 'Utilisateurs de Noken', [
      ['Contenu', `Un compte par ligne : ${comptes.length} comptes.`],
      [
        'Confidentialité',
        "Données personnelles, réservées à l'administration de Noken. À ne pas diffuser ni transmettre hors de la structure ; supprimer le fichier une fois son usage terminé.",
      ],
      [
        'Données écartées',
        "La date de naissance est remplacée par l'âge, et la situation de handicap réduite à un oui ou non, sans sa nature : un tableau qui circule n'a pas à porter de données de santé détaillées.",
      ],
    ]);

    type Compte = (typeof comptes)[number];
    feuilleTableau<Compte>(
      classeur,
      'Utilisateurs',
      [
        { entete: 'N°', largeur: 8, valeur: (c) => c.id },
        { entete: 'Prénom', largeur: 16, valeur: (c) => c.firstName ?? '' },
        { entete: 'Nom', largeur: 18, valeur: (c) => c.lastName ?? '' },
        { entete: "Nom d'utilisateur", largeur: 18, valeur: (c) => c.username },
        { entete: 'E-mail', largeur: 30, valeur: (c) => c.email },
        { entete: 'Téléphone', largeur: 16, valeur: (c) => c.telephone ?? '' },
        { entete: 'Rôle', largeur: 14, valeur: (c) => libelle(ROLES, c.role) },
        {
          entete: 'Compte actif',
          largeur: 12,
          valeur: (c) => ouiNon(c.isActive),
        },
        {
          entete: 'E-mail vérifié',
          largeur: 13,
          valeur: (c) => ouiNon(c.isEmailVerified),
        },
        {
          entete: 'Connexion Google',
          largeur: 15,
          valeur: (c) => ouiNon(c.isGoogleLogin),
        },
        {
          entete: 'Statut professionnel',
          largeur: 20,
          valeur: (c) => libelle(STATUTS_PRO, c.statutProfessionnel),
        },
        { entete: 'Sexe', largeur: 12, valeur: (c) => libelle(SEXES, c.sexe) },
        {
          entete: 'Âge',
          largeur: 8,
          valeur: (c) => ageDe(c.dateNaissance, maintenant),
        },
        {
          entete: "Tranche d'âge",
          largeur: 16,
          valeur: (c) => trancheAge(ageDe(c.dateNaissance, maintenant)),
        },
        {
          entete: 'Région',
          largeur: 16,
          valeur: (c) => c.region ?? NON_RENSEIGNE,
        },
        {
          entete: 'Département',
          largeur: 16,
          valeur: (c) => c.departement ?? NON_RENSEIGNE,
        },
        {
          entete: 'Commune',
          largeur: 18,
          valeur: (c) => c.commune ?? NON_RENSEIGNE,
        },
        {
          entete: 'Handicap déclaré',
          largeur: 15,
          valeur: (c) => ouiNon(c.handicap),
        },
        { entete: 'CV', largeur: 7, valeur: (c) => ouiNon(Boolean(c.cv)) },
        {
          entete: 'CV visible des recruteurs',
          largeur: 22,
          valeur: (c) => (c.cv ? ouiNon(c.cv.estPublic) : ''),
        },
        {
          entete: 'Favoris',
          largeur: 9,
          valeur: (c) => c._count.favorites,
          format: ENTIER,
        },
        {
          entete: "J'aime",
          largeur: 8,
          valeur: (c) => c._count.likes,
          format: ENTIER,
        },
        {
          entete: 'Commentaires',
          largeur: 13,
          valeur: (c) => c._count.commentaires,
          format: ENTIER,
        },
        {
          entete: "Retours d'expérience",
          largeur: 19,
          valeur: (c) => c._count.retours,
          format: ENTIER,
        },
        {
          entete: "Questions à l'assistant",
          largeur: 21,
          valeur: (c) => questionsDe.get(c.id) ?? 0,
          format: ENTIER,
        },
        {
          entete: 'Offres publiées',
          largeur: 14,
          valeur: (c) => c._count.offres,
          format: ENTIER,
        },
        {
          entete: 'Inscription',
          largeur: 17,
          valeur: (c) => c.createdAt,
          format: DATE_HEURE,
        },
        {
          entete: 'CGU acceptées le',
          largeur: 16,
          valeur: (c) => c.cguAccepteeLe,
          format: DATE,
        },
      ],
      comptes,
    );

    return classeur;
  }

  /* ------------------------------------------------------------ offres --- */

  async offres(): Promise<Workbook> {
    const maintenant = new Date();
    const site = (this.config.get<string>('frontend.url') ?? '').replace(
      /\/+$/,
      '',
    );
    const offres = await this.prisma.offre.findMany({
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        entreprise: true,
        secteur: true,
        localisation: true,
        niveauExperience: true,
        typeEmploi: true,
        teletravail: true,
        nombrePostes: true,
        salaireMin: true,
        salaireMax: true,
        salaireDevise: true,
        salairePeriode: true,
        datePublication: true,
        dateLimite: true,
        statutModeration: true,
        estCloturee: true,
        estEpinglee: true,
        estBrouillon: true,
        viewCount: true,
        typeOffre: { select: { libelle: true } },
        auteur: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
            role: true,
          },
        },
        _count: {
          select: {
            likes: true,
            favorites: true,
            commentaires: true,
            retours: true,
          },
        },
      },
    });

    const classeur = this.nouveauClasseur();
    this.feuilleApropos(classeur, 'Offres publiées sur Noken', [
      [
        'Contenu',
        `Une offre par ligne : ${offres.length} offres, de la plus récente à la plus ancienne.`,
      ],
      [
        'Engagement',
        "Vues, j'aime, favoris, commentaires et retours d'expérience, cumulés depuis la publication de chaque offre.",
      ],
      [
        'Échéance',
        "« Ouverte » tant que la date limite n'est pas passée, « Dépassée » ensuite ; « Sans date limite » quand l'offre n'en a pas.",
      ],
    ]);

    type Offre = (typeof offres)[number];
    feuilleTableau<Offre>(
      classeur,
      'Offres',
      [
        { entete: 'N°', largeur: 8, valeur: (o) => o.id },
        { entete: 'Titre', largeur: 48, valeur: (o) => o.titre, long: true },
        {
          entete: 'Type',
          largeur: 14,
          valeur: (o) => o.typeOffre?.libelle ?? '',
        },
        { entete: 'Structure', largeur: 26, valeur: (o) => o.entreprise ?? '' },
        {
          entete: 'Secteur',
          largeur: 18,
          valeur: (o) => libelle(SECTEURS, o.secteur),
        },
        {
          entete: 'Localisation',
          largeur: 20,
          valeur: (o) => o.localisation ?? '',
        },
        {
          entete: 'Niveau',
          largeur: 12,
          valeur: (o) =>
            o.niveauExperience ? libelle(NIVEAUX, o.niveauExperience) : '',
        },
        {
          entete: 'Type de contrat',
          largeur: 15,
          valeur: (o) => (o.typeEmploi ? libelle(CONTRATS, o.typeEmploi) : ''),
        },
        {
          entete: 'Télétravail',
          largeur: 12,
          valeur: (o) => o.teletravail ?? '',
        },
        {
          entete: 'Postes',
          largeur: 8,
          valeur: (o) => o.nombrePostes ?? null,
          format: ENTIER,
        },
        {
          entete: 'Salaire min',
          largeur: 12,
          valeur: (o) => o.salaireMin ?? null,
          format: ENTIER,
        },
        {
          entete: 'Salaire max',
          largeur: 12,
          valeur: (o) => o.salaireMax ?? null,
          format: ENTIER,
        },
        { entete: 'Devise', largeur: 8, valeur: (o) => o.salaireDevise ?? '' },
        {
          entete: 'Période de salaire',
          largeur: 17,
          valeur: (o) => o.salairePeriode ?? '',
        },
        {
          entete: 'Publication',
          largeur: 13,
          valeur: (o) => o.datePublication,
          format: DATE,
        },
        {
          entete: 'Date limite',
          largeur: 13,
          valeur: (o) => o.dateLimite,
          format: DATE,
        },
        {
          entete: 'Échéance',
          largeur: 16,
          valeur: (o) =>
            !o.dateLimite
              ? 'Sans date limite'
              : o.dateLimite.getTime() >= maintenant.getTime()
                ? 'Ouverte'
                : 'Dépassée',
        },
        {
          entete: 'Statut',
          largeur: 12,
          valeur: (o) => libelle(MODERATION, o.statutModeration),
        },
        {
          entete: 'Clôturée',
          largeur: 10,
          valeur: (o) => ouiNon(o.estCloturee),
        },
        {
          entete: 'Épinglée',
          largeur: 10,
          valeur: (o) => ouiNon(o.estEpinglee),
        },
        {
          entete: 'Brouillon',
          largeur: 10,
          valeur: (o) => ouiNon(o.estBrouillon),
        },
        { entete: 'Auteur', largeur: 22, valeur: (o) => nomComplet(o.auteur) },
        {
          entete: "Rôle de l'auteur",
          largeur: 15,
          valeur: (o) => libelle(ROLES, o.auteur.role),
        },
        {
          entete: 'Vues',
          largeur: 9,
          valeur: (o) => o.viewCount,
          format: ENTIER,
        },
        {
          entete: "J'aime",
          largeur: 8,
          valeur: (o) => o._count.likes,
          format: ENTIER,
        },
        {
          entete: 'Favoris',
          largeur: 9,
          valeur: (o) => o._count.favorites,
          format: ENTIER,
        },
        {
          entete: 'Commentaires',
          largeur: 13,
          valeur: (o) => o._count.commentaires,
          format: ENTIER,
        },
        {
          entete: 'Retours',
          largeur: 9,
          valeur: (o) => o._count.retours,
          format: ENTIER,
        },
        {
          entete: 'Lien',
          largeur: 34,
          valeur: (o) => {
            const url = `${site}/offres/${o.id}`;
            return { text: url, hyperlink: url };
          },
        },
      ],
      offres,
    );

    return classeur;
  }

  /* ----------------------------------------------------------- rapport --- */

  /**
   * Rapport statistique, une feuille par indicateur.
   *
   * Les chiffres viennent des mêmes méthodes que la page Statistiques : le
   * fichier et l'écran se recoupent au chiffre près. Seules exceptions, les
   * secteurs, départements et communes, que la page limite à ses premiers
   * rangs : ici on les veut entiers, sans quoi les parts porteraient sur un
   * extrait.
   */
  async rapport(mois: number): Promise<Workbook> {
    const [
      rapport,
      statistiques,
      public_,
      types,
      secteurs,
      departements,
      communes,
    ] = await Promise.all([
      this.admin.getRapport(mois),
      this.admin.getStatistics(),
      this.admin.getUsersDisaggregation(),
      this.prisma.typeOffre.findMany({ select: { code: true, libelle: true } }),
      this.prisma.offre.groupBy({ by: ['secteur'], _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['departement'], _count: { _all: true } }),
      this.prisma.user.groupBy({ by: ['commune'], _count: { _all: true } }),
    ]);

    const classeur = this.nouveauClasseur();
    this.feuilleApropos(classeur, 'Rapport statistique de Noken', [
      [
        'Période',
        `${rapport.periode.mois} mois glissants, à partir du ${new Date(rapport.periode.debut).toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' })}.`,
      ],
      [
        'Contenu',
        'Une feuille par indicateur. Les effectifs sont accompagnés de leur part, rangée comme un pourcentage réel : on peut en refaire la somme ou le graphique.',
      ],
      [
        'Source',
        "Les mêmes chiffres que la page Statistiques de la console, au moment de l'export. Les secteurs, départements et communes sont ici complets, là où la page n'en montre que les premiers.",
      ],
    ]);

    const parRole = rapport.utilisateursParRole;
    const e = rapport.engagement;
    feuilleTableau<[string, number]>(
      classeur,
      'Synthèse',
      [
        {
          entete: 'Indicateur',
          largeur: 46,
          valeur: ([indicateur]) => indicateur,
        },
        {
          entete: 'Valeur',
          largeur: 14,
          valeur: ([, valeur]) => valeur,
          format: ENTIER,
        },
      ],
      [
        ['Comptes inscrits', statistiques.totals.users],
        ['— dont membres', parRole.MEMBRE ?? 0],
        ['— dont structures partenaires', parRole.PARTENAIRE ?? 0],
        ['— dont administrateurs', parRole.ADMIN ?? 0],
        ['Offres publiées (toutes périodes)', statistiques.totals.offres],
        ['Offres encore ouvertes', e.offresOuvertes],
        ['CV enregistrés', e.cvTotal],
        ['CV visibles des recruteurs', e.cvPublics],
        ['Fiches de structures partenaires', e.partenaires],
        ["Retours d'expérience (toutes périodes)", statistiques.totals.retours],
        [`Inscriptions sur ${mois} mois`, e.inscriptionsPeriode],
        [`Offres publiées sur ${mois} mois`, e.publicationsPeriode],
        [`Retours d'expérience sur ${mois} mois`, e.retoursPeriode],
        [`J'aime sur ${mois} mois`, e.likesPeriode],
        [`Mises en favori sur ${mois} mois`, e.favorisPeriode],
      ],
    );

    type Mois = (typeof rapport.evolution)[number];
    const versDate = (cle: string): Date | string => {
      const correspondance = /^(\d{4})-(\d{2})$/.exec(cle);
      return correspondance
        ? new Date(
            Date.UTC(
              Number(correspondance[1]),
              Number(correspondance[2]) - 1,
              1,
            ),
          )
        : cle;
    };
    feuilleTableau<Mois>(
      classeur,
      'Évolution mensuelle',
      [
        {
          entete: 'Mois',
          largeur: 18,
          valeur: (m) => versDate(m.mois),
          format: MOIS,
        },
        {
          entete: 'Inscriptions',
          largeur: 13,
          valeur: (m) => m.inscriptions,
          format: ENTIER,
        },
        {
          entete: 'Offres publiées',
          largeur: 15,
          valeur: (m) => m.publications,
          format: ENTIER,
        },
        {
          entete: "Retours d'expérience",
          largeur: 19,
          valeur: (m) => m.retours,
          format: ENTIER,
        },
        {
          entete: "J'aime",
          largeur: 9,
          valeur: (m) => m.likes,
          format: ENTIER,
        },
        {
          entete: 'Mises en favori',
          largeur: 15,
          valeur: (m) => m.favoris,
          format: ENTIER,
        },
      ],
      rapport.evolution,
    );

    const libelleType = new Map(types.map((type) => [type.code, type.libelle]));
    feuilleRepartition(
      classeur,
      'Offres par type',
      "Type d'offre",
      Object.entries(rapport.offresParType).map(([code, effectif]) => ({
        categorie: libelleType.get(code) ?? code,
        effectif: Number(effectif),
      })),
    );

    feuilleRepartition(
      classeur,
      'Offres par secteur',
      'Secteur',
      secteurs.map((ligne) => ({
        categorie: libelle(SECTEURS, ligne.secteur),
        effectif: ligne._count._all,
      })),
    );

    feuilleRepartition(
      classeur,
      'Offres par statut',
      'Statut de validation',
      Object.entries(rapport.offresParStatut).map(([statut, effectif]) => ({
        categorie: libelle(MODERATION, statut),
        effectif: Number(effectif),
      })),
    );

    feuilleRepartition(
      classeur,
      'Rôles',
      'Rôle',
      Object.entries(parRole).map(([role, effectif]) => ({
        categorie: libelle(ROLES, role),
        effectif: Number(effectif),
      })),
    );

    feuilleRepartition(classeur, 'Sexe', 'Sexe', [
      { categorie: SEXES.FEMME, effectif: public_.gender.femmes },
      { categorie: SEXES.HOMME, effectif: public_.gender.hommes },
      { categorie: SEXES.AUTRE, effectif: public_.gender.autres },
      { categorie: SEXES.NON_PRECISE, effectif: public_.gender.nonPrecise },
    ]);

    feuilleRepartition(
      classeur,
      "Tranches d'âge",
      "Tranche d'âge",
      Object.entries(public_.ageRanges).map(([tranche, effectif]) => ({
        categorie: AGES[tranche] ?? tranche,
        effectif: Number(effectif),
      })),
      false,
    );

    feuilleRepartition(
      classeur,
      'Statut professionnel',
      'Statut professionnel',
      Object.entries(public_.statutProfessionnel).map(([statut, effectif]) => ({
        categorie: libelle(STATUTS_PRO, statut),
        effectif: Number(effectif),
      })),
    );

    feuilleRepartition(
      classeur,
      'Régions',
      'Région',
      public_.regions.map((ligne) => ({
        categorie:
          ligne.region === 'Non précisé' ? NON_RENSEIGNE : ligne.region,
        effectif: ligne.count,
      })),
    );

    feuilleRepartition(
      classeur,
      'Départements',
      'Département',
      departements.map((ligne) => ({
        categorie: ligne.departement ?? NON_RENSEIGNE,
        effectif: ligne._count._all,
      })),
    );

    feuilleRepartition(
      classeur,
      'Communes',
      'Commune',
      communes.map((ligne) => ({
        categorie: ligne.commune ?? NON_RENSEIGNE,
        effectif: ligne._count._all,
      })),
    );

    feuilleRepartition(
      classeur,
      'Handicap',
      'Situation de handicap déclarée',
      [
        { categorie: 'Oui', effectif: public_.handicap.avec },
        { categorie: 'Non', effectif: public_.handicap.sans },
      ],
      false,
    );

    return classeur;
  }

  /* ---------------------------------------------- questions à l'assistant */

  async questionsAssistant(jours: number): Promise<Workbook> {
    const debut = jours > 0 ? new Date(Date.now() - jours * JOUR) : null;
    const messages = await this.prisma.chatMessage.findMany({
      where: debut ? { timestamp: { gte: debut } } : {},
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        role: true,
        content: true,
        timestamp: true,
        conversationId: true,
        conversation: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
                role: true,
                statutProfessionnel: true,
                region: true,
              },
            },
          },
        },
      },
    });

    // Chaque question reçoit la réponse qui la suit dans sa conversation.
    const parConversation = new Map<string, typeof messages>();
    for (const message of messages) {
      const liste = parConversation.get(message.conversationId) ?? [];
      liste.push(message);
      parConversation.set(message.conversationId, liste);
    }
    const reponseDe = new Map<number, string>();
    for (const liste of parConversation.values()) {
      for (let i = 0; i < liste.length - 1; i += 1) {
        if (liste[i].role === 'user' && liste[i + 1].role === 'assistant') {
          reponseDe.set(liste[i].id, liste[i + 1].content);
        }
      }
    }

    const questions = messages
      .filter((message) => message.role === 'user')
      .reverse();

    const classeur = this.nouveauClasseur();
    this.feuilleApropos(classeur, "Questions posées à l'assistant IA", [
      [
        'Période',
        debut
          ? `${jours} derniers jours, depuis le ${debut.toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' })}.`
          : "Tout l'historique de l'assistant.",
      ],
      [
        'Contenu',
        `Une question par ligne : ${questions.length} questions, de la plus récente à la plus ancienne, avec la réponse donnée.`,
      ],
      [
        'Thèmes',
        'Repérés par mots-clés, comme dans la rubrique « Agents IA » de la console ; une question peut en toucher plusieurs.',
      ],
      [
        'Confidentialité',
        "Les questions sont nominatives et peuvent contenir des éléments personnels. Réservé à l'administration de Noken ; à ne pas diffuser.",
      ],
    ]);

    type Question = (typeof questions)[number];
    feuilleTableau<Question>(
      classeur,
      'Questions',
      [
        {
          entete: 'Date',
          largeur: 17,
          valeur: (q) => q.timestamp,
          format: DATE_HEURE,
        },
        {
          entete: 'Personne',
          largeur: 22,
          valeur: (q) => nomComplet(q.conversation.user),
        },
        {
          entete: 'N° du compte',
          largeur: 12,
          valeur: (q) => q.conversation.user.id,
        },
        {
          entete: 'Rôle',
          largeur: 14,
          valeur: (q) => libelle(ROLES, q.conversation.user.role),
        },
        {
          entete: 'Statut professionnel',
          largeur: 20,
          valeur: (q) =>
            libelle(STATUTS_PRO, q.conversation.user.statutProfessionnel),
        },
        {
          entete: 'Région',
          largeur: 16,
          valeur: (q) => q.conversation.user.region ?? NON_RENSEIGNE,
        },
        {
          entete: 'Question',
          largeur: 60,
          valeur: (q) => q.content,
          long: true,
        },
        {
          entete: 'Thèmes',
          largeur: 30,
          valeur: (q) =>
            themesDe(q.content)
              .map((cle) => LIBELLES_THEMES.get(cle) ?? cle)
              .join(', ') || 'Autres sujets',
          long: true,
        },
        {
          entete: 'Réponse obtenue',
          largeur: 15,
          valeur: (q) => {
            const reponse = reponseDe.get(q.id);
            if (!reponse) return 'Non';
            return REPLI.test(reponse.trim()) ? 'En échec' : 'Oui';
          },
        },
        {
          entete: "Réponse de l'assistant",
          largeur: 80,
          valeur: (q) => {
            const reponse = reponseDe.get(q.id);
            return reponse ? texteSimple(reponse).slice(0, 32_000) : '';
          },
          long: true,
        },
      ],
      questions,
    );

    return classeur;
  }

  /* --------------------------------------------------------- communs ---- */

  private nouveauClasseur(): Workbook {
    const classeur = new Workbook();
    classeur.creator = 'Noken';
    classeur.created = new Date();
    return classeur;
  }

  private feuilleApropos(
    classeur: Workbook,
    titre: string,
    lignes: [string, string][],
  ) {
    const feuille = classeur.addWorksheet('À propos');
    feuille.getColumn(1).width = 22;
    feuille.getColumn(2).width = 96;

    const entete = feuille.addRow([titre]);
    entete.font = { bold: true, size: 14, color: { argb: BLEU } };
    feuille.addRow([]);

    const genere = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Africa/Dakar',
    }).format(new Date());

    for (const [cle, valeur] of [
      ['Plateforme', 'Noken — emploi, formations et bourses au Sénégal'] as [
        string,
        string,
      ],
      ['Généré le', `${genere} (heure de Dakar)`] as [string, string],
      ...lignes,
    ]) {
      const ligne = feuille.addRow([cle, valeur]);
      ligne.getCell(1).font = { bold: true };
      ligne.getCell(1).alignment = { vertical: 'top' };
      ligne.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    }
  }
}
