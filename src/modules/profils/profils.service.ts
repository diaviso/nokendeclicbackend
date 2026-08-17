import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CVService } from '../cv/cv.service';
import { RechercheProfilsDto } from './dto/recherche-profils.dto';

/**
 * Un profil tel qu'il ressort d'une recherche : le CV visible, un score de
 * correspondance et les raisons de ce score.
 */
export interface ProfilClasse {
  score: number;
  /** Ce qui a fait monter le profil, à afficher au recruteur. */
  raisons: string[];
  /** Termes de la recherche retrouvés dans les compétences déclarées. */
  competencesCorrespondantes: string[];
  cv: Record<string, any>;
}

/** Poids du classement. Rassemblés ici pour être lus et discutés d'un bloc. */
const POIDS = {
  /** Une compétence demandée retrouvée telle quelle. */
  competenceExacte: 30,
  /** Une compétence retrouvée en sous-chaîne : « react » dans « React Native ». */
  competencePartielle: 15,
  /** Le terme apparaît dans le titre professionnel. */
  titre: 25,
  /** Le terme apparaît dans le résumé. */
  resume: 10,
  /** Le terme apparaît dans un intitulé de poste déjà occupé. */
  experience: 12,
  /** Le terme apparaît dans un diplôme ou un établissement. */
  formation: 8,
  /** Profil dans la ville ou la région demandée. */
  localisation: 20,
  /** Langue demandée déclarée. */
  langue: 10,
  /** Le CV est renseigné au-delà du minimum : il est exploitable. */
  completude: 12,
  /** CV mis à jour récemment : la personne est probablement encore en recherche. */
  fraicheur: 8,
} as const;

@Injectable()
export class ProfilsService {
  constructor(private prisma: PrismaService) {}

  /** Retire les diacritiques et met en minuscules, pour comparer des saisies. */
  private normaliser(texte: string): string {
    return texte
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /** Découpe une requête libre en termes utiles, en écartant les mots outils. */
  private termes(requete?: string): string[] {
    if (!requete) return [];

    // Les mots de liaison n'apportent rien au classement et feraient remonter
    // n'importe quel profil dont le résumé est bavard.
    const outils = new Set([
      'de', 'du', 'des', 'le', 'la', 'les', 'un', 'une', 'et', 'ou', 'en',
      'a', 'au', 'aux', 'pour', 'avec', 'sur', 'dans', 'par',
    ]);

    return this.normaliser(requete)
      .split(/[^a-z0-9+#.]+/)
      .filter((mot) => mot.length >= 2 && !outils.has(mot));
  }

  /**
   * Recherche de profils, classée par correspondance.
   *
   * Le filtrage grossier est fait par Postgres, le classement en mémoire sur
   * l'ensemble filtré. Ce partage tient tant que les CV visibles se comptent en
   * milliers — c'est le cas ici, et de loin. Au-delà, il faudra passer le score
   * en SQL (`ts_rank` sur un index de recherche plein texte) ; le seuil est
   * signalé par `total` dans la réponse.
   *
   * Aucun tri par date en secours : une liste « bien classée » est ce qui a été
   * demandé, et une correspondance faible reste plus utile qu'un profil récent
   * sans rapport. Les profils à score nul sont donc écartés dès qu'une requête
   * est posée.
   */
  async rechercher(filtres: RechercheProfilsDto) {
    const { page = 1, limit = 20 } = filtres;

    const termes = this.termes(filtres.q);
    const competencesDemandees = (filtres.competences ?? [])
      .map((competence) => this.normaliser(competence))
      .filter(Boolean);
    const langueDemandee = filtres.langue
      ? this.normaliser(filtres.langue)
      : null;
    const lieuDemande = filtres.localisation
      ? this.normaliser(filtres.localisation)
      : null;

    // Filtre en base : uniquement les CV rendus visibles par leur auteur, et
    // dont le compte est toujours actif — un profil désactivé ne doit pas être
    // proposé au recrutement.
    const where: any = {
      estPublic: true,
      user: { isActive: true },
    };

    if (filtres.statutProfessionnel) {
      where.user.statutProfessionnel = filtres.statutProfessionnel;
    }

    const cvs = await this.prisma.cV.findMany({
      where,
      select: {
        ...CVService.SELECT_RECRUTEUR,
        experiences: {
          orderBy: { dateDebut: 'desc' as const },
          select: {
            poste: true,
            entreprise: true,
            dateDebut: true,
            dateFin: true,
            enCours: true,
          },
        },
        formations: {
          orderBy: { dateDebut: 'desc' as const },
          select: { diplome: true, etablissement: true, dateFin: true },
        },
      },
    });

    const classes = cvs
      .map((cv) =>
        this.noter(cv, {
          termes,
          competencesDemandees,
          langueDemandee,
          lieuDemande,
        }),
      )
      .filter((profil) => {
        // Sans critère, la recherche présente tout le vivier : le recruteur
        // découvre ce qui existe. Avec critères, un profil sans la moindre
        // correspondance n'a rien à faire dans la liste.
        const aDesCriteres =
          termes.length > 0 ||
          competencesDemandees.length > 0 ||
          Boolean(langueDemandee) ||
          Boolean(lieuDemande);
        return !aDesCriteres || profil.score > 0;
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          // À score égal, le CV le plus fraîchement tenu à jour d'abord.
          new Date(b.cv.dateModification).getTime() -
            new Date(a.cv.dateModification).getTime(),
      );

    const debut = (page - 1) * limit;

    return {
      data: classes.slice(debut, debut + limit),
      total: classes.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(classes.length / limit)),
      hasMore: debut + limit < classes.length,
    };
  }

  /** Attribue son score à un profil, et note pourquoi. */
  private noter(
    cv: Record<string, any>,
    criteres: {
      termes: string[];
      competencesDemandees: string[];
      langueDemandee: string | null;
      lieuDemande: string | null;
    },
  ): ProfilClasse {
    const { termes, competencesDemandees, langueDemandee, lieuDemande } =
      criteres;

    let score = 0;
    const raisons: string[] = [];
    const correspondantes = new Set<string>();

    const competences: string[] = cv.competences ?? [];
    const competencesNormalisees = competences.map((c) => ({
      brute: c,
      normalisee: this.normaliser(c),
    }));

    const titre = this.normaliser(cv.titreProfessionnel ?? '');
    const resume = this.normaliser(cv.resume ?? '');
    const postes = (cv.experiences ?? []).map((e: any) =>
      this.normaliser(`${e.poste ?? ''} ${e.entreprise ?? ''}`),
    );
    const diplomes = (cv.formations ?? []).map((f: any) =>
      this.normaliser(`${f.diplome ?? ''} ${f.etablissement ?? ''}`),
    );

    /** Confronte un terme à toutes les surfaces du CV. */
    const confronter = (terme: string, exigence: boolean) => {
      let trouve = false;

      for (const competence of competencesNormalisees) {
        if (competence.normalisee === terme) {
          score += POIDS.competenceExacte;
          correspondantes.add(competence.brute);
          trouve = true;
        } else if (competence.normalisee.includes(terme)) {
          score += POIDS.competencePartielle;
          correspondantes.add(competence.brute);
          trouve = true;
        }
      }

      if (titre.includes(terme)) {
        score += POIDS.titre;
        trouve = true;
      }
      if (resume.includes(terme)) {
        score += POIDS.resume;
        trouve = true;
      }
      if (postes.some((poste) => poste.includes(terme))) {
        score += POIDS.experience;
        trouve = true;
      }
      if (diplomes.some((diplome) => diplome.includes(terme))) {
        score += POIDS.formation;
        trouve = true;
      }

      // Une compétence explicitement demandée et absente pénalise : entre deux
      // profils, celui qui coche tout doit passer devant celui qui coche la
      // moitié, même si son résumé est plus fourni.
      if (!trouve && exigence) {
        score -= POIDS.competencePartielle;
      }

      return trouve;
    };

    for (const terme of termes) confronter(terme, false);

    let competencesTrouvees = 0;
    for (const competence of competencesDemandees) {
      if (confronter(competence, true)) competencesTrouvees += 1;
    }

    if (competencesDemandees.length > 0) {
      raisons.push(
        `${competencesTrouvees} compétence${competencesTrouvees > 1 ? 's' : ''} sur ${competencesDemandees.length} demandée${competencesDemandees.length > 1 ? 's' : ''}`,
      );
    }

    if (langueDemandee) {
      const langues: string[] = cv.langues ?? [];
      if (langues.some((l) => this.normaliser(l).includes(langueDemandee))) {
        score += POIDS.langue;
        raisons.push('Langue demandée déclarée');
      }
    }

    if (lieuDemande) {
      const lieu = this.normaliser(
        `${cv.ville ?? ''} ${cv.pays ?? ''} ${cv.user?.region ?? ''}`,
      );
      if (lieu.includes(lieuDemande)) {
        score += POIDS.localisation;
        raisons.push('Situé dans la zone recherchée');
      }
    }

    // Un CV renseigné est un CV sur lequel on peut décider. Sans ce poids, un
    // profil vide contenant par hasard le bon mot devancerait un dossier
    // complet.
    const complet =
      competences.length >= 3 &&
      (cv.experiences?.length ?? 0) >= 1 &&
      Boolean(cv.resume);
    if (complet) {
      score += POIDS.completude;
      raisons.push('CV complet');
    }

    const joursDepuisMaj =
      (Date.now() - new Date(cv.dateModification).getTime()) / 86_400_000;
    if (joursDepuisMaj <= 90) {
      score += POIDS.fraicheur;
      raisons.push('CV mis à jour récemment');
    }

    return {
      score: Math.max(0, Math.round(score)),
      raisons,
      competencesCorrespondantes: [...correspondantes],
      cv,
    };
  }

  /**
   * Vivier des compétences déclarées, pour alimenter les suggestions du champ
   * de recherche. Comptées sur les seuls CV visibles : proposer un terme qui ne
   * ramène aucun profil ferait perdre du temps.
   */
  async competencesDisponibles() {
    const cvs = await this.prisma.cV.findMany({
      where: { estPublic: true, user: { isActive: true } },
      select: { competences: true },
    });

    const compte = new Map<string, { libelle: string; total: number }>();

    for (const cv of cvs) {
      // Une même compétence n'est comptée qu'une fois par profil, quelle que
      // soit sa graphie dans le CV.
      const vues = new Set<string>();
      for (const competence of cv.competences) {
        const cle = this.normaliser(competence);
        if (!cle || vues.has(cle)) continue;
        vues.add(cle);

        const existant = compte.get(cle);
        if (existant) existant.total += 1;
        else compte.set(cle, { libelle: competence, total: 1 });
      }
    }

    return [...compte.values()]
      .sort((a, b) => b.total - a.total || a.libelle.localeCompare(b.libelle))
      .slice(0, 60);
  }
}
