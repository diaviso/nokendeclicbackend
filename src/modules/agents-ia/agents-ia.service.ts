import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SUGGESTIONS_ASSISTANT } from '../chatbot/suggestions';

const JOUR = 86_400_000;

/** Réponse de repli de l'assistant, quand aucune réponse n'a pu être produite. */
const REPLI = /^d[ée]sol[ée],? je n['’]ai pas pu g[ée]n[ée]rer une r[ée]ponse/i;

/** Champs d'un utilisateur affichés dans les classements et les listes. */
const PROFIL = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  pictureUrl: true,
  role: true,
} as const;

/** Minuscules, sans accents : « Touré » et « TOURE » se comparent. */
function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Forme de comparaison d'une question : sans accents, sans ponctuation, sans
 * espaces superflus. Deux personnes qui tapent « Quelles bourses sont
 * disponibles ? » et « quelles bourses sont disponibles » posent la même
 * question.
 */
function cleQuestion(texte: string): string {
  return normaliser(texte)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function part(valeur: number, total: number): number {
  return total > 0 ? Math.round((valeur * 1000) / total) / 10 : 0;
}

function evolution(actuel: number, avant: number): number | null {
  return avant > 0 ? Math.round(((actuel - avant) / avant) * 100) : null;
}

/**
 * Mots qui ne disent rien du sujet d'une question. Sans ce filtre, « les »,
 * « quelles » et « sont » occuperaient le haut du classement des mots.
 */
const MOTS_VIDES = new Set(
  `a ai aie aimerais ainsi alors as au aucun aussi autre autres aux avec avez
  avoir avons besoin bon bonjour bonsoir ca car ce ceci cela celle celles celui
  cependant ces cest cet cette ceux chaque chez ci comme comment dans de des deja
  depuis dire dis dois doit donc donne donner dont du elle elles en encore entre
  es est et etais etait etc ete etes etre eu faire fais fait faut hello ici il ils
  jai jaimerais je jusqu la le les leur leurs lui ma mais me merci meme mes moi
  mon montre montrer ne ni nos notre nous on ont ou par parce pas peu peut peux
  plait plus pour pourquoi pourrais pouvez puis qu quand que quel quelle quelles
  quels quelque quelques qui quoi sa sais salut sans savoir se ses si sil son sont
  souhaite stp suis sur svp ta te tes toi ton tous tout toute toutes tres trouver
  tu un une vers veux voici voila vos votre vous voudrais vouloir vu y ya
  disponible disponibles recente recentes recents actuellement maintenant avoir
  quest ce`.split(/\s+/),
);

/**
 * Thèmes des questions, repérés par le début des mots.
 *
 * Une classification par mots-clés plutôt que par un modèle : elle ne coûte
 * rien, se relit, et donne le même résultat à chaque calcul. Une question peut
 * relever de plusieurs thèmes — « une formation pour améliorer mon CV ».
 */
const THEMES: { cle: string; libelle: string; racines: string[] }[] = [
  {
    cle: 'emploi',
    libelle: "Offres d'emploi",
    racines: [
      'emploi',
      'job',
      'travail',
      'poste',
      'recrut',
      'cdi',
      'cdd',
      'embauch',
      'salaire',
      'boulot',
    ],
  },
  {
    cle: 'formation',
    libelle: 'Formations',
    racines: [
      'formation',
      'former',
      'cours',
      'apprend',
      'certif',
      'diplom',
      'etude',
      'etudi',
      'ecole',
      'universit',
      'master',
      'licence',
    ],
  },
  {
    cle: 'bourse',
    libelle: 'Bourses',
    racines: ['bourse', 'financ', 'etranger'],
  },
  {
    cle: 'stage',
    libelle: 'Stages',
    racines: ['stage', 'stagiaire', 'alternan', 'apprenti'],
  },
  {
    cle: 'cv',
    libelle: 'CV et candidature',
    racines: [
      'cv',
      'curriculum',
      'lettre',
      'motivation',
      'candidat',
      'postul',
      'entretien',
      'dossier',
    ],
  },
  {
    cle: 'orientation',
    libelle: 'Compétences et orientation',
    racines: [
      'competen',
      'orient',
      'conseil',
      'carriere',
      'reconver',
      'metier',
      'profil',
      'ameliorer',
      'progress',
      'avenir',
    ],
  },
  {
    cle: 'secteurs',
    libelle: 'Secteurs et marché',
    racines: ['secteur', 'domaine', 'marche', 'industri'],
  },
  {
    cle: 'volontariat',
    libelle: 'Volontariat',
    racines: ['volontar', 'benevol', 'civique', 'humanitaire'],
  },
  {
    cle: 'entreprises',
    libelle: 'Entreprises et recruteurs',
    racines: ['entreprise', 'societe', 'partenaire', 'recruteur', 'employeur'],
  },
  {
    cle: 'plateforme',
    libelle: 'Utilisation de Noken',
    racines: [
      'noken',
      'compte',
      'inscri',
      'connexion',
      'connect',
      'application',
      'appli',
      'plateforme',
      'notification',
      'favori',
    ],
  },
];

/** Lieux du Sénégal, sous leur forme normalisée. */
const LIEUX: { lieu: string; formes: string[] }[] = [
  { lieu: 'Dakar', formes: ['dakar'] },
  { lieu: 'Ziguinchor', formes: ['ziguinchor', 'zig'] },
  { lieu: 'Casamance', formes: ['casamance'] },
  { lieu: 'Thiès', formes: ['thies'] },
  { lieu: 'Saint-Louis', formes: ['saint louis', 'st louis'] },
  { lieu: 'Kolda', formes: ['kolda'] },
  { lieu: 'Sédhiou', formes: ['sedhiou'] },
  { lieu: 'Tambacounda', formes: ['tambacounda', 'tamba'] },
  { lieu: 'Kaolack', formes: ['kaolack'] },
  { lieu: 'Fatick', formes: ['fatick'] },
  { lieu: 'Kaffrine', formes: ['kaffrine'] },
  { lieu: 'Kédougou', formes: ['kedougou'] },
  { lieu: 'Louga', formes: ['louga'] },
  { lieu: 'Matam', formes: ['matam'] },
  { lieu: 'Diourbel', formes: ['diourbel'] },
  { lieu: 'Touba', formes: ['touba'] },
  { lieu: 'Mbour', formes: ['mbour'] },
  { lieu: 'Rufisque', formes: ['rufisque'] },
  { lieu: 'Oussouye', formes: ['oussouye'] },
  { lieu: 'Bignona', formes: ['bignona'] },
  { lieu: 'Cap Skirring', formes: ['cap skirring'] },
  { lieu: 'Vélingara', formes: ['velingara'] },
];

const TRANCHES_AGE = [
  'Moins de 18 ans',
  '18–25 ans',
  '26–35 ans',
  '36–45 ans',
  '46 ans et plus',
  'Non renseigné',
];

function trancheAge(naissance: Date | null, maintenant: Date): string {
  if (!naissance) return 'Non renseigné';
  const age = Math.floor(
    (maintenant.getTime() - naissance.getTime()) / (365.25 * JOUR),
  );
  if (age < 18) return 'Moins de 18 ans';
  if (age <= 25) return '18–25 ans';
  if (age <= 35) return '26–35 ans';
  if (age <= 45) return '36–45 ans';
  return '46 ans et plus';
}

function themesDe(texte: string): string[] {
  const mots = cleQuestion(texte).split(' ');
  return THEMES.filter((theme) =>
    mots.some((mot) => theme.racines.some((racine) => mot.startsWith(racine))),
  ).map((theme) => theme.cle);
}

function libelleFichier(mime: string): string {
  const libelles: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/jpeg': 'Photo JPEG',
    'image/jpg': 'Photo JPEG',
    'image/png': 'Image PNG',
    'image/webp': 'Image WebP',
    'image/heic': 'Photo HEIC',
    'image/heif': 'Photo HEIC',
  };
  return libelles[mime] ?? mime;
}

type Profil = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  username: string;
  pictureUrl: string | null;
  role: string;
};

function vue(profil: Profil) {
  return {
    id: profil.id,
    firstName: profil.firstName,
    lastName: profil.lastName,
    username: profil.username,
    pictureUrl: profil.pictureUrl,
    role: profil.role,
  };
}

/**
 * Statistiques d'usage des agents IA : l'assistant et l'extracteur de CV.
 *
 * Tout est centré sur les personnes — qui s'en sert, pour demander quoi, avec
 * quelle fidélité — et non sur la consommation technique.
 *
 * L'assistant conserve ses échanges depuis son ouverture : ses statistiques
 * couvrent tout l'historique. L'extracteur ne gardait aucune trace ; son
 * journal commence avec la version qui l'a introduit, et la réponse le dit.
 *
 * Les volumes de la plateforme — quelques centaines de questions — permettent
 * de tout calculer en mémoire à partir des messages : c'est plus simple à
 * relire qu'une série de requêtes d'agrégation, et bien assez rapide.
 */
@Injectable()
export class AgentsIaService {
  constructor(private readonly prisma: PrismaService) {}

  /** @param jours taille de la période ; 0 pour tout l'historique. */
  async statistiques(jours: number) {
    const fin = new Date();
    const debut = jours > 0 ? new Date(fin.getTime() - jours * JOUR) : null;

    const [
      messages,
      toutesQuestions,
      comptesTotal,
      precedentes,
      extractions,
      premiereExtraction,
      cvTotal,
    ] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: debut ? { timestamp: { gte: debut } } : {},
        select: {
          id: true,
          role: true,
          content: true,
          timestamp: true,
          conversationId: true,
          conversation: { select: { userId: true } },
        },
        orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      }),
      // Toutes périodes confondues : c'est la première question de chacun qui
      // dit s'il est nouveau venu ou habitué.
      this.prisma.chatMessage.findMany({
        where: { role: 'user' },
        select: { timestamp: true, conversation: { select: { userId: true } } },
        orderBy: { timestamp: 'asc' },
      }),
      this.prisma.user.count(),
      debut
        ? this.prisma.chatMessage.findMany({
            where: {
              role: 'user',
              timestamp: {
                gte: new Date(debut.getTime() - jours * JOUR),
                lt: debut,
              },
            },
            select: { conversation: { select: { userId: true } } },
          })
        : Promise.resolve(null),
      this.prisma.extractionCV.findMany({
        where: debut ? { createdAt: { gte: debut } } : {},
        orderBy: { createdAt: 'desc' },
        include: { user: { select: PROFIL } },
      }),
      this.prisma.extractionCV.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.cV.count(),
    ]);

    /* ======================================================= assistant == */

    const questions = messages.filter((message) => message.role === 'user');
    const reponses = messages.filter((message) => message.role === 'assistant');
    const auteur = (message: (typeof messages)[number]) =>
      message.conversation.userId;

    // Chaque question reçoit la réponse qui la suit dans sa conversation.
    const parConversation = new Map<string, typeof messages>();
    for (const message of messages) {
      const liste = parConversation.get(message.conversationId) ?? [];
      liste.push(message);
      parConversation.set(message.conversationId, liste);
    }
    const reponseDe = new Map<number, (typeof messages)[number]>();
    for (const liste of parConversation.values()) {
      for (let i = 0; i < liste.length - 1; i += 1) {
        if (liste[i].role === 'user' && liste[i + 1].role === 'assistant') {
          reponseDe.set(liste[i].id, liste[i + 1]);
        }
      }
    }

    // Une question récente peut attendre sa réponse : on ne la compte comme
    // restée sans réponse qu'au-delà de cinq minutes.
    const sansReponse = questions.filter(
      (question) =>
        !reponseDe.has(question.id) &&
        fin.getTime() - question.timestamp.getTime() > 5 * 60_000,
    ).length;
    const echecs = reponses.filter((reponse) =>
      REPLI.test(reponse.content.trim()),
    ).length;

    const premiereQuestion = new Map<number, Date>();
    for (const question of toutesQuestions) {
      const id = question.conversation.userId;
      if (!premiereQuestion.has(id))
        premiereQuestion.set(id, question.timestamp);
    }

    const parUtilisateur = new Map<
      number,
      {
        questions: number;
        conversations: Set<string>;
        jours: Set<string>;
        derniere: Date;
      }
    >();
    for (const question of questions) {
      const id = auteur(question);
      const agregat = parUtilisateur.get(id) ?? {
        questions: 0,
        conversations: new Set<string>(),
        jours: new Set<string>(),
        derniere: question.timestamp,
      };
      agregat.questions += 1;
      agregat.conversations.add(question.conversationId);
      agregat.jours.add(question.timestamp.toISOString().slice(0, 10));
      if (question.timestamp > agregat.derniere)
        agregat.derniere = question.timestamp;
      parUtilisateur.set(id, agregat);
    }

    const idsUtilisateurs = [...parUtilisateur.keys()];
    const utilisateurs = idsUtilisateurs.length;
    const nouveaux = debut
      ? idsUtilisateurs.filter(
          (id) =>
            (premiereQuestion.get(id) ?? fin).getTime() >= debut.getTime(),
        ).length
      : utilisateurs;
    const fideles = [...parUtilisateur.values()].filter(
      (agregat) => agregat.jours.size >= 2,
    ).length;

    const [profils, parStatut, parSexe, parRegion, parRole, naissances] =
      await Promise.all([
        this.prisma.user.findMany({
          where: { id: { in: idsUtilisateurs } },
          select: {
            ...PROFIL,
            statutProfessionnel: true,
            sexe: true,
            dateNaissance: true,
            region: true,
          },
        }),
        this.prisma.user.groupBy({
          by: ['statutProfessionnel'],
          _count: { _all: true },
        }),
        this.prisma.user.groupBy({ by: ['sexe'], _count: { _all: true } }),
        this.prisma.user.groupBy({ by: ['region'], _count: { _all: true } }),
        this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
        this.prisma.user.findMany({ select: { dateNaissance: true } }),
      ]);
    const profilDe = new Map(
      profils.map((profil) => [profil.id, profil] as const),
    );

    // ----------------------------------------------- qui l'utilise --------
    const comparer = (
      dimension: 'statut' | 'sexe' | 'age' | 'region' | 'role',
      libelle: string,
      valeurDe: (profil: (typeof profils)[number]) => string,
      membres: Map<string, number>,
      ordre?: string[],
    ) => {
      const assistant = new Map<string, number>();
      for (const profil of profils) {
        const valeur = valeurDe(profil);
        assistant.set(valeur, (assistant.get(valeur) ?? 0) + 1);
      }
      const totalMembres = [...membres.values()].reduce((s, n) => s + n, 0);
      let lignes = [...new Set([...membres.keys(), ...assistant.keys()])].map(
        (valeur) => ({
          valeur,
          assistant: assistant.get(valeur) ?? 0,
          partAssistant: part(assistant.get(valeur) ?? 0, profils.length),
          membres: membres.get(valeur) ?? 0,
          partMembres: part(membres.get(valeur) ?? 0, totalMembres),
        }),
      );

      if (ordre) {
        lignes.sort(
          (a, b) => ordre.indexOf(a.valeur) - ordre.indexOf(b.valeur),
        );
      } else {
        lignes.sort(
          (a, b) => b.assistant - a.assistant || b.membres - a.membres,
        );
      }

      // Les régions sont nombreuses : au-delà des huit premières, un reliquat.
      if (dimension === 'region' && lignes.length > 8) {
        const reste = lignes.slice(8);
        lignes = [
          ...lignes.slice(0, 8),
          {
            valeur: 'Autres régions',
            assistant: reste.reduce((s, l) => s + l.assistant, 0),
            partAssistant:
              Math.round(reste.reduce((s, l) => s + l.partAssistant, 0) * 10) /
              10,
            membres: reste.reduce((s, l) => s + l.membres, 0),
            partMembres:
              Math.round(reste.reduce((s, l) => s + l.partMembres, 0) * 10) /
              10,
          },
        ];
      }

      return { dimension, libelle, lignes };
    };

    const enCarte = <T extends Record<string, unknown>>(
      lignes: (T & { _count: { _all: number } })[],
      cle: keyof T,
      vide: string,
    ) =>
      new Map<string, number>(
        lignes.map((ligne): [string, number] => [
          (ligne[cle] as string | null) ?? vide,
          ligne._count._all,
        ]),
      );

    const agesMembres = new Map<string, number>();
    for (const { dateNaissance } of naissances) {
      const tranche = trancheAge(dateNaissance, fin);
      agesMembres.set(tranche, (agesMembres.get(tranche) ?? 0) + 1);
    }

    const profil = [
      comparer(
        'statut',
        'Statut professionnel',
        (p) => p.statutProfessionnel ?? 'NON_PRECISE',
        enCarte(parStatut, 'statutProfessionnel', 'NON_PRECISE'),
      ),
      comparer(
        'age',
        "Tranche d'âge",
        (p) => trancheAge(p.dateNaissance, fin),
        agesMembres,
        TRANCHES_AGE,
      ),
      comparer(
        'sexe',
        'Sexe',
        (p) => p.sexe ?? 'NON_PRECISE',
        enCarte(parSexe, 'sexe', 'NON_PRECISE'),
      ),
      comparer(
        'region',
        'Région',
        (p) => p.region ?? 'Non renseignée',
        enCarte(parRegion, 'region', 'Non renseignée'),
      ),
      comparer(
        'role',
        'Rôle',
        (p) => p.role,
        enCarte(parRole, 'role', 'MEMBRE'),
      ),
    ];

    // ------------------------------------------------ de quoi on parle ----
    const compteThemes = new Map<string, number>();
    let sansTheme = 0;
    const lieux = new Map<string, number>();
    const mots = new Map<string, number>();
    const groupes = new Map<
      string,
      {
        texte: string;
        occurrences: number;
        utilisateurs: Set<number>;
        derniere: Date;
      }
    >();

    for (const question of questions) {
      const themes = themesDe(question.content);
      if (themes.length === 0) sansTheme += 1;
      for (const theme of themes)
        compteThemes.set(theme, (compteThemes.get(theme) ?? 0) + 1);

      const cle = cleQuestion(question.content);
      const encadree = ` ${cle} `;
      for (const { lieu, formes } of LIEUX) {
        if (formes.some((forme) => encadree.includes(` ${forme} `))) {
          lieux.set(lieu, (lieux.get(lieu) ?? 0) + 1);
        }
      }

      // Un mot compte une fois par question : on mesure combien de questions
      // l'évoquent, pas combien de fois il est répété.
      for (const mot of new Set(cle.split(' '))) {
        if (mot.length < 2 || MOTS_VIDES.has(mot) || /^\d+$/.test(mot))
          continue;
        mots.set(mot, (mots.get(mot) ?? 0) + 1);
      }

      if (cle) {
        const groupe = groupes.get(cle) ?? {
          texte: question.content.trim(),
          occurrences: 0,
          utilisateurs: new Set<number>(),
          derniere: question.timestamp,
        };
        groupe.occurrences += 1;
        groupe.utilisateurs.add(auteur(question));
        if (question.timestamp >= groupe.derniere) {
          groupe.derniere = question.timestamp;
          groupe.texte = question.content.trim();
        }
        groupes.set(cle, groupe);
      }
    }

    const themes = [
      ...THEMES.map((theme) => ({
        cle: theme.cle,
        libelle: theme.libelle,
        questions: compteThemes.get(theme.cle) ?? 0,
        part: part(compteThemes.get(theme.cle) ?? 0, questions.length),
      })),
      {
        cle: 'autre',
        libelle: 'Autres sujets',
        questions: sansTheme,
        part: part(sansTheme, questions.length),
      },
    ]
      .filter((theme) => theme.questions > 0)
      .sort((a, b) => b.questions - a.questions);

    const clesSuggestions = new Set(SUGGESTIONS_ASSISTANT.map(cleQuestion));
    const questionsFrequentes = [...groupes.entries()]
      .map(([cle, groupe]) => ({
        texte: groupe.texte,
        occurrences: groupe.occurrences,
        utilisateurs: groupe.utilisateurs.size,
        derniere: groupe.derniere.toISOString(),
        suggestion: clesSuggestions.has(cle),
      }))
      .sort(
        (a, b) =>
          b.occurrences - a.occurrences || b.derniere.localeCompare(a.derniere),
      )
      .slice(0, 15);

    const suggestions = SUGGESTIONS_ASSISTANT.map((texte) => {
      const groupe = groupes.get(cleQuestion(texte));
      return {
        texte,
        occurrences: groupe?.occurrences ?? 0,
        utilisateurs: groupe?.utilisateurs.size ?? 0,
      };
    }).sort((a, b) => b.occurrences - a.occurrences);

    // ------------------------------------------------ classements --------
    const classement = [...parUtilisateur.entries()]
      .map(([id, agregat]) => {
        const p = profilDe.get(id);
        if (!p) return null;
        return {
          user: vue(p),
          questions: agregat.questions,
          conversations: agregat.conversations.size,
          joursActifs: agregat.jours.size,
          premiere: (
            premiereQuestion.get(id) ?? agregat.derniere
          ).toISOString(),
          derniere: agregat.derniere.toISOString(),
          profil: {
            statutProfessionnel: p.statutProfessionnel ?? null,
            region: p.region ?? null,
          },
        };
      })
      .filter((ligne): ligne is NonNullable<typeof ligne> => ligne !== null)
      .sort(
        (a, b) =>
          b.questions - a.questions || b.derniere.localeCompare(a.derniere),
      )
      .slice(0, 20);

    const tranches = [
      { tranche: '1 question', min: 1, max: 1 },
      { tranche: '2 questions', min: 2, max: 2 },
      { tranche: '3 à 5', min: 3, max: 5 },
      { tranche: '6 à 10', min: 6, max: 10 },
      { tranche: 'Plus de 10', min: 11, max: Number.POSITIVE_INFINITY },
    ];
    const engagement = tranches.map(({ tranche, min, max }) => ({
      tranche,
      utilisateurs: [...parUtilisateur.values()].filter(
        (agregat) => agregat.questions >= min && agregat.questions <= max,
      ).length,
    }));

    // ------------------------------------------------ quand ---------------
    // Le Sénégal vit à l'heure UTC toute l'année : l'heure universelle est
    // l'heure locale, sans conversion.
    const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const question of questions) {
      const jour = (question.timestamp.getUTCDay() + 6) % 7;
      heatmap[jour][question.timestamp.getUTCHours()] += 1;
    }

    const granularite: 'jour' | 'semaine' =
      jours > 0 && jours <= 90 ? 'jour' : 'semaine';
    const cleCase = (date: Date) => {
      if (granularite === 'jour') return date.toISOString().slice(0, 10);
      const lundi = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate() - ((date.getUTCDay() + 6) % 7),
        ),
      );
      return lundi.toISOString().slice(0, 10);
    };
    const origine =
      debut ??
      [questions[0]?.timestamp, premiereExtraction?.createdAt]
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => a.getTime() - b.getTime())[0] ??
      fin;
    const cases: string[] = [];
    const pas = (granularite === 'jour' ? 1 : 7) * JOUR;
    for (
      let curseur = new Date(`${cleCase(origine)}T00:00:00Z`);
      curseur.getTime() <= fin.getTime();
      curseur = new Date(curseur.getTime() + pas)
    ) {
      cases.push(curseur.toISOString().slice(0, 10));
    }

    const questionsParCase = new Map<
      string,
      { questions: number; utilisateurs: Set<number> }
    >();
    for (const question of questions) {
      const cle = cleCase(question.timestamp);
      const valeur = questionsParCase.get(cle) ?? {
        questions: 0,
        utilisateurs: new Set<number>(),
      };
      valeur.questions += 1;
      valeur.utilisateurs.add(auteur(question));
      questionsParCase.set(cle, valeur);
    }

    // ------------------------------------------------ dernières questions -
    const dernieres = [...questions]
      .reverse()
      .slice(0, 30)
      .map((question) => {
        const reponse = reponseDe.get(question.id);
        const p = profilDe.get(auteur(question));
        return {
          id: question.id,
          date: question.timestamp.toISOString(),
          contenu: question.content,
          user: p ? vue(p) : null,
          conversationId: question.conversationId,
          themes: themesDe(question.content),
          reponse: reponse ? reponse.content.slice(0, 4000) : null,
          reponseEnEchec: reponse ? REPLI.test(reponse.content.trim()) : false,
        };
      });

    const reponsesUtiles = reponses.filter(
      (reponse) => !REPLI.test(reponse.content.trim()),
    );
    const moyenne = (valeurs: number[]) =>
      valeurs.length
        ? Math.round(valeurs.reduce((s, v) => s + v, 0) / valeurs.length)
        : 0;

    const utilisateursPrecedents = precedentes
      ? new Set(precedentes.map((message) => message.conversation.userId)).size
      : 0;

    const assistant = {
      indicateurs: {
        questions: questions.length,
        conversations: new Set(questions.map((q) => q.conversationId)).size,
        utilisateurs,
        nouveaux,
        fideles,
        questionsParUtilisateur:
          utilisateurs > 0
            ? Math.round((questions.length / utilisateurs) * 10) / 10
            : 0,
        utilisateursTotal: premiereQuestion.size,
        comptesTotal,
        adoption: part(premiereQuestion.size, comptesTotal),
        echecs,
        sansReponse,
      },
      tendance: precedentes
        ? {
            questions: evolution(questions.length, precedentes.length),
            utilisateurs: evolution(utilisateurs, utilisateursPrecedents),
          }
        : { questions: null, utilisateurs: null },
      activite: cases.map((date) => ({
        date,
        questions: questionsParCase.get(date)?.questions ?? 0,
        utilisateurs: questionsParCase.get(date)?.utilisateurs.size ?? 0,
      })),
      heatmap,
      themes,
      lieux: [...lieux.entries()]
        .map(([lieu, mentions]) => ({ lieu, mentions }))
        .sort((a, b) => b.mentions - a.mentions),
      mots: [...mots.entries()]
        .map(([mot, occurrences]) => ({ mot, occurrences }))
        .sort(
          (a, b) => b.occurrences - a.occurrences || a.mot.localeCompare(b.mot),
        )
        .slice(0, 25),
      questionsFrequentes,
      suggestions,
      classement,
      engagement,
      profil,
      dernieres,
      longueurs: {
        question: moyenne(questions.map((q) => q.content.length)),
        reponse: moyenne(reponsesUtiles.map((r) => r.content.length)),
      },
    };

    /* ====================================================== extracteur == */

    // Une analyse sans erreur qui n'a rien tiré du document n'est pas une
    // réussite pour la personne : elle reçoit un formulaire vide. Le journal
    // garde la vérité technique ; les statistiques la requalifient, sans quoi
    // un fichier illisible gonflerait le taux de réussite.
    const estVide = (extraction: {
      experiences: number;
      formations: number;
      competences: number;
    }) =>
      extraction.experiences +
        extraction.formations +
        extraction.competences ===
      0;
    const reussies = extractions.filter(
      (extraction) => extraction.succes && !estVide(extraction),
    );
    const vides = extractions.filter(
      (extraction) => extraction.succes && estVide(extraction),
    );

    const parType = new Map<
      string,
      { extractions: number; reussies: number }
    >();
    const parMode = new Map<string, number>();
    const echecsExtraction = new Map<string, number>();
    const parExtracteur = new Map<
      number,
      { user: Profil; extractions: number; reussies: number; derniere: Date }
    >();
    const extractionsParCase = new Map<string, number>();

    for (const extraction of extractions) {
      const type = libelleFichier(extraction.typeFichier);
      const ligne = parType.get(type) ?? { extractions: 0, reussies: 0 };
      ligne.extractions += 1;
      if (extraction.succes && !estVide(extraction)) ligne.reussies += 1;
      parType.set(type, ligne);

      parMode.set(extraction.mode, (parMode.get(extraction.mode) ?? 0) + 1);

      if (!extraction.succes && extraction.erreur) {
        const erreur = extraction.erreur.slice(0, 200);
        echecsExtraction.set(erreur, (echecsExtraction.get(erreur) ?? 0) + 1);
      }

      if (extraction.user) {
        const agregat = parExtracteur.get(extraction.user.id) ?? {
          user: extraction.user,
          extractions: 0,
          reussies: 0,
          derniere: extraction.createdAt,
        };
        agregat.extractions += 1;
        if (extraction.succes && !estVide(extraction)) agregat.reussies += 1;
        if (extraction.createdAt > agregat.derniere)
          agregat.derniere = extraction.createdAt;
        parExtracteur.set(extraction.user.id, agregat);
      }

      const cle = cleCase(extraction.createdAt);
      extractionsParCase.set(cle, (extractionsParCase.get(cle) ?? 0) + 1);
    }

    const moyenneDecimale = (valeurs: number[]) =>
      valeurs.length
        ? Math.round(
            (valeurs.reduce((s, v) => s + v, 0) / valeurs.length) * 10,
          ) / 10
        : 0;

    const extracteur = {
      mesureDepuis: premiereExtraction?.createdAt.toISOString() ?? null,
      indicateurs: {
        extractions: extractions.length,
        utilisateurs: new Set(
          extractions
            .map((e) => e.userId)
            .filter((id): id is number => id !== null),
        ).size,
        reussies: reussies.length,
        vides: vides.length,
        tauxReussite: part(reussies.length, extractions.length),
        cvTotal,
        membresAvecCv: part(cvTotal, comptesTotal),
      },
      activite: cases.map((date) => ({
        date,
        extractions: extractionsParCase.get(date) ?? 0,
      })),
      parType: [...parType.entries()]
        .map(([type, ligne]) => ({ type, ...ligne }))
        .sort((a, b) => b.extractions - a.extractions),
      parMode: [...parMode.entries()]
        .map(([mode, total]) => ({ mode, extractions: total }))
        .sort((a, b) => b.extractions - a.extractions),
      richesse: reussies.length
        ? {
            experiences: moyenneDecimale(reussies.map((e) => e.experiences)),
            formations: moyenneDecimale(reussies.map((e) => e.formations)),
            competences: moyenneDecimale(reussies.map((e) => e.competences)),
          }
        : null,
      echecs: [...echecsExtraction.entries()]
        .map(([erreur, occurrences]) => ({ erreur, occurrences }))
        .sort((a, b) => b.occurrences - a.occurrences)
        .slice(0, 5),
      classement: [...parExtracteur.values()]
        .map((agregat) => ({
          user: vue(agregat.user),
          extractions: agregat.extractions,
          reussies: agregat.reussies,
          derniere: agregat.derniere.toISOString(),
        }))
        .sort(
          (a, b) =>
            b.extractions - a.extractions ||
            b.derniere.localeCompare(a.derniere),
        )
        .slice(0, 10),
      dernieres: extractions.slice(0, 30).map((extraction) => ({
        id: extraction.id,
        date: extraction.createdAt.toISOString(),
        user: extraction.user ? vue(extraction.user) : null,
        type: libelleFichier(extraction.typeFichier),
        tailleKo: extraction.tailleKo,
        mode: extraction.mode,
        succes: extraction.succes,
        vide: extraction.succes && estVide(extraction),
        erreur: extraction.erreur,
        experiences: extraction.experiences,
        formations: extraction.formations,
        competences: extraction.competences,
      })),
    };

    return {
      periode: {
        jours,
        debut: debut?.toISOString() ?? null,
        fin: fin.toISOString(),
        granularite,
      },
      assistant,
      extracteur,
    };
  }
}
