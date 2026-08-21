import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Compare les mots sans tenir compte des accents : « société » = « societe ». */
function sansAccents(mot: string) {
  return mot.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Vocabulaire d'annonce à écarter d'une analyse de compétences.
 *
 * Ces mots peuplent toutes les offres sans rien dire du métier : les laisser
 * passer ferait conseiller à quelqu'un d'ajouter « candidature » à son CV.
 */
const MOTS_VIDES = new Set([
  'recrute', 'recrutement', 'recherche', 'recherchons', 'offre', 'offres',
  'poste', 'postes', 'candidat', 'candidats', 'candidate', 'candidates',
  'candidature', 'candidatures', 'postuler', 'profil', 'profils', 'mission',
  'missions', 'contrat', 'entreprise', 'societe', 'structure', 'partners',
  'partner', 'sarl', 'projet', 'projets', 'programme', 'programmes',
  'travail', 'travailleur', 'travailleuse', 'emploi', 'employe', 'salarie',
  'dossier', 'dossiers', 'lettre', 'motivation', 'curriculum', 'vitae',
  'diplome', 'diplomes', 'niveau', 'annees', 'annee', 'experience',
  'experiences', 'competence', 'competences', 'connaissance', 'connaissances',
  'capacite', 'capacites', 'maitrise', 'bonne', 'bonnes', 'excellente',
  'excellentes', 'solide', 'solides', 'sens', 'esprit', 'qualites',
  'exigences', 'requis', 'requises', 'souhaite', 'souhaitee', 'obligatoire',
  'description', 'responsabilites', 'activites', 'taches', 'principales',
  'general', 'generale', 'cadre', 'conditions', 'informations', 'details',
  'suivantes', 'suivants', 'differents', 'differentes', 'notamment', 'ainsi',
  'egalement', 'aupres', 'depuis', 'pendant', 'toutes', 'tous', 'autres',
  'plusieurs', 'chaque', 'entre', 'selon', 'entre', 'entre', 'partir',
  'cette', 'cettes', 'leurs', 'leur', 'elles', 'nous', 'vous', 'votre',
  'notre', 'nos', 'dans', 'pour', 'avec', 'sans', 'sous', 'plus', 'moins',
  'lieu', 'date', 'limite', 'depot', 'senegal', 'senegalais', 'senegalaise',
  'societe', 'basee', 'basé', 'base', 'situee', 'situe', 'compte', 'cadre',
  'poste', 'contexte', 'objectif', 'objectifs', 'ci-dessous', 'dessous',
  'merci', 'veuillez', 'seront', 'seules', 'seuls', 'retenues', 'retenus',
  'contactes', 'contactees', 'interesse', 'interessees', 'personnes',
]);

@Injectable()
export class ChatbotToolsService {
  constructor(private prisma: PrismaService) {}

  // ==================== PROFIL UTILISATEUR ====================

  async getUserProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    }) as any;

    if (!user) return { error: 'Utilisateur non trouvé' };

    return {
      nom: user.lastName,
      prenom: user.firstName,
      email: user.email,
      username: user.username,
      statutProfessionnel: user.statutProfessionnel || 'Non renseigné',
      localisation: {
        pays: user.pays || 'Non renseigné',
        region: user.region || 'Non renseigné',
        departement: user.departement || 'Non renseigné',
        commune: user.commune || 'Non renseigné',
      },
      membreDepuis: user.createdAt,
    };
  }

  // ==================== CV UTILISATEUR ====================

  async getUserCV(userId: number) {
    const cv = await this.prisma.cV.findUnique({
      where: { userId },
      include: {
        experiences: { orderBy: { dateDebut: 'desc' } },
        formations: { orderBy: { dateDebut: 'desc' } },
      },
    });

    if (!cv) return { hasCV: false, message: "L'utilisateur n'a pas encore créé de CV" };

    return {
      hasCV: true,
      titreProfessionnel: cv.titreProfessionnel || 'Non renseigné',
      resume: cv.resume || 'Non renseigné',
      contact: {
        telephone: cv.telephone || 'Non renseigné',
        adresse: cv.adresse || 'Non renseigné',
        ville: cv.ville || 'Non renseigné',
        pays: cv.pays || 'Non renseigné',
      },
      reseaux: {
        linkedin: cv.linkedin || null,
        github: cv.github || null,
        siteWeb: cv.siteWeb || null,
      },
      competences: cv.competences || [],
      langues: cv.langues || [],
      certifications: cv.certifications || [],
      interets: cv.interets || [],
      nombreExperiences: cv.experiences.length,
      nombreFormations: cv.formations.length,
    };
  }

  async getUserExperiences(userId: number) {
    const cv = await this.prisma.cV.findUnique({
      where: { userId },
      include: {
        experiences: { orderBy: { dateDebut: 'desc' } },
      },
    });

    if (!cv) return { error: "L'utilisateur n'a pas de CV" };

    return cv.experiences.map((exp) => ({
      poste: exp.poste,
      entreprise: exp.entreprise,
      ville: exp.ville || 'Non renseigné',
      dateDebut: exp.dateDebut,
      dateFin: exp.dateFin || 'En cours',
      enCours: exp.enCours,
      description: exp.description || 'Non renseigné',
    }));
  }

  async getUserFormations(userId: number) {
    const cv = await this.prisma.cV.findUnique({
      where: { userId },
      include: {
        formations: { orderBy: { dateDebut: 'desc' } },
      },
    });

    if (!cv) return { error: "L'utilisateur n'a pas de CV" };

    return cv.formations.map((form) => ({
      diplome: form.diplome,
      etablissement: form.etablissement,
      ville: form.ville || 'Non renseigné',
      dateDebut: form.dateDebut,
      dateFin: form.dateFin || 'En cours',
      enCours: form.enCours,
      description: form.description || 'Non renseigné',
    }));
  }

  async getUserCompetences(userId: number) {
    const cv = await this.prisma.cV.findUnique({
      where: { userId },
      select: { competences: true },
    });

    if (!cv) return { error: "L'utilisateur n'a pas de CV" };

    return {
      competences: cv.competences || [],
      nombreCompetences: cv.competences?.length || 0,
    };
  }

  // ==================== OFFRES ====================

  async getOffresMatchingCompetences(userId: number) {
    const cv = await this.prisma.cV.findUnique({
      where: { userId },
      select: { competences: true },
    });

    if (!cv || !cv.competences?.length) {
      return { error: "Aucune compétence trouvée dans le CV pour faire la correspondance" };
    }

    // Rechercher les offres qui contiennent des mots-clés des compétences
    const offres = await this.prisma.offre.findMany({
      where: {
        statutModeration: 'PUBLIEE',
        OR: cv.competences.map((comp) => ({
          OR: [
            { titre: { contains: comp, mode: 'insensitive' } },
            { description: { contains: comp, mode: 'insensitive' } },
            { tags: { has: comp } },
          ],
        })),
      },
      take: 10,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        typeOffre: { select: { code: true, libelle: true } },
        entreprise: true,
        localisation: true,
        champs: true,
        tags: true,
      },
    });

    return {
      competencesUtilisees: cv.competences,
      offresCorrespondantes: offres,
      nombreOffres: offres.length,
    };
  }

  async getOffresMatchingExperience(userId: number) {
    const cv = await this.prisma.cV.findUnique({
      where: { userId },
      include: { experiences: true },
    });

    if (!cv || !cv.experiences?.length) {
      return { error: "Aucune expérience trouvée dans le CV" };
    }

    // Extraire les postes et secteurs des expériences
    const postes = cv.experiences.map((exp) => exp.poste);

    const offres = await this.prisma.offre.findMany({
      where: {
        statutModeration: 'PUBLIEE',
        OR: postes.map((poste) => ({
          OR: [
            { titre: { contains: poste, mode: 'insensitive' } },
            { description: { contains: poste, mode: 'insensitive' } },
          ],
        })),
      },
      take: 10,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        typeOffre: { select: { code: true, libelle: true } },
        entreprise: true,
        localisation: true,
        niveauExperience: true,
        champs: true,
      },
    });

    return {
      postesExperience: postes,
      offresCorrespondantes: offres,
      nombreOffres: offres.length,
    };
  }

  async getOffresParLocalisation(localisation: string) {
    const offres = await this.prisma.offre.findMany({
      where: {
        statutModeration: 'PUBLIEE',
        localisation: { contains: localisation, mode: 'insensitive' },
      },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        typeOffre: { select: { code: true, libelle: true } },
        entreprise: true,
        localisation: true,
        champs: true,
      },
    });

    return {
      localisation,
      offres,
      nombreOffres: offres.length,
    };
  }

  async getOffresParType(typeOffre: string) {
    const offres = await this.prisma.offre.findMany({
      where: { statutModeration: 'PUBLIEE', typeOffre: { code: typeOffre.toUpperCase() } },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        typeOffre: { select: { code: true, libelle: true } },
        entreprise: true,
        localisation: true,
        secteur: true,
        champs: true,
      },
    });

    return {
      typeOffre,
      offres,
      nombreOffres: offres.length,
    };
  }

  async getOffresParSecteur(secteur: string) {
    const offres = await this.prisma.offre.findMany({
      where: { statutModeration: 'PUBLIEE', secteur: secteur as any },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        typeOffre: { select: { code: true, libelle: true } },
        entreprise: true,
        localisation: true,
        niveauExperience: true,
        champs: true,
      },
    });

    return {
      secteur,
      offres,
      nombreOffres: offres.length,
    };
  }

  async searchOffres(query: string) {
    const offres = await this.prisma.offre.findMany({
      where: {
        statutModeration: 'PUBLIEE',
        OR: [
          { titre: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { entreprise: { contains: query, mode: 'insensitive' } },
          { localisation: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        typeOffre: { select: { code: true, libelle: true } },
        entreprise: true,
        localisation: true,
        secteur: true,
        description: true,
      },
    });

    return {
      recherche: query,
      offres,
      nombreOffres: offres.length,
    };
  }

  // ==================== FAVORIS & RETOURS ====================

  async getUserFavoris(userId: number) {
    const favoris = await this.prisma.favorite.findMany({
      where: { userId },
      include: {
        offre: {
          select: {
            id: true,
            titre: true,
            typeOffre: { select: { code: true, libelle: true } },
            entreprise: true,
            localisation: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      favoris: favoris.map((f) => f.offre),
      nombreFavoris: favoris.length,
    };
  }

  async getUserRetours(userId: number) {
    const retours = await this.prisma.retour.findMany({
      where: { auteurId: userId },
      include: {
        offre: {
          select: {
            id: true,
            titre: true,
            typeOffre: { select: { code: true, libelle: true } },
            entreprise: true,
          },
        },
      },
      orderBy: { datePublication: 'desc' },
    }) as any[];

    return {
      candidatures: retours.map((r) => ({
        offre: r.offre,
        statut: r.statut || 'En attente',
        datePostulation: r.datePublication,
        message: r.contenu?.substring(0, 100) + '...',
      })),
      nombreCandidatures: retours.length,
    };
  }

  // ==================== STATISTIQUES ====================

  async getStatistiquesOffres() {
    const [total, parType, parSecteur, parLocalisation] = await Promise.all([
      this.prisma.offre.count({ where: { statutModeration: 'PUBLIEE' } }),
      this.prisma.offre.groupBy({
        by: ['typeOffreId'],
        where: { statutModeration: 'PUBLIEE' },
        _count: { typeOffreId: true },
      }),
      this.prisma.offre.groupBy({
        by: ['secteur'],
        where: { statutModeration: 'PUBLIEE' },
        _count: { secteur: true },
        orderBy: { _count: { secteur: 'desc' } },
        take: 10,
      }),
      this.prisma.offre.groupBy({
        by: ['localisation'],
        where: { statutModeration: 'PUBLIEE' },
        _count: { localisation: true },
        orderBy: { _count: { localisation: 'desc' } },
        take: 10,
      }),
    ]);

    // Les types sont administrables : leur code se lit en base plutôt que
    // d'être déduit d'une énumération figée.
    const types = await this.prisma.typeOffre.findMany({
      select: { id: true, code: true, libelle: true },
    });
    const parId = new Map(types.map((type) => [type.id, type]));

    return {
      totalOffres: total,
      parType: parType.map((t) => ({
        type: parId.get(t.typeOffreId)?.code ?? 'INCONNU',
        libelle: parId.get(t.typeOffreId)?.libelle ?? 'Inconnu',
        count: t._count.typeOffreId,
      })),
      topSecteurs: parSecteur.map((s) => ({ secteur: s.secteur, count: s._count.secteur })),
      topLocalisations: parLocalisation.map((l) => ({ localisation: l.localisation, count: l._count.localisation })),
    };
  }

  async getFormationsDisponibles() {
    const formations = await this.prisma.offre.findMany({
      where: { statutModeration: 'PUBLIEE', typeOffre: { code: 'FORMATION' } },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        localisation: true,
        description: true,
      },
    });

    return {
      formations,
      nombreFormations: formations.length,
    };
  }

  async getBoursesDisponibles() {
    const bourses = await this.prisma.offre.findMany({
      where: { statutModeration: 'PUBLIEE', typeOffre: { code: 'BOURSE' } },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        localisation: true,
        description: true,
      },
    });

    return {
      bourses,
      nombreBourses: bourses.length,
    };
  }

  async getVolontariatsDisponibles() {
    const volontariats = await this.prisma.offre.findMany({
      where: { statutModeration: 'PUBLIEE', typeOffre: { code: 'VOLONTARIAT' } },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        localisation: true,
        description: true,
      },
    });

    return {
      volontariats,
      nombreVolontariats: volontariats.length,
    };
  }

  // ==================== RECOMMANDATIONS PERSONNALISÉES ====================

  async getRecommandationsPersonnalisees(userId: number) {
    const cv = await this.prisma.cV.findUnique({
      where: { userId },
      include: {
        experiences: true,
        formations: true,
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    }) as any;

    if (!cv) {
      return {
        message: "Créez votre CV pour recevoir des recommandations personnalisées",
        recommandations: [],
      };
    }

    // Construire les critères de recherche
    const searchTerms: string[] = [];
    
    // Ajouter les compétences
    if (cv.competences?.length) {
      searchTerms.push(...cv.competences.slice(0, 5));
    }
    
    // Ajouter les postes des expériences
    if (cv.experiences?.length) {
      searchTerms.push(...cv.experiences.map((e) => e.poste).slice(0, 3));
    }

    // Ajouter les diplômes
    if (cv.formations?.length) {
      searchTerms.push(...cv.formations.map((f) => f.diplome).slice(0, 2));
    }

    if (!searchTerms.length) {
      return {
        message: "Complétez votre CV avec vos compétences et expériences pour des recommandations",
        recommandations: [],
      };
    }

    // Rechercher les offres correspondantes
    const offres = await this.prisma.offre.findMany({
      where: {
        statutModeration: 'PUBLIEE',
        OR: searchTerms.flatMap((term) => [
          { titre: { contains: term, mode: 'insensitive' } },
          { description: { contains: term, mode: 'insensitive' } },
          { tags: { has: term } },
        ]),
      },
      take: 10,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        typeOffre: { select: { code: true, libelle: true } },
        entreprise: true,
        localisation: true,
        secteur: true,
        niveauExperience: true,
        champs: true,
      },
    });

    // Calculer un score de pertinence simple
    const scoredOffres = offres.map((offre) => {
      let score = 0;
      const titreDesc = `${offre.titre} ${offre.secteur || ''}`.toLowerCase();
      
      searchTerms.forEach((term) => {
        if (titreDesc.includes(term.toLowerCase())) score += 2;
      });

      // Bonus si même localisation
      if (user?.commune && offre.localisation?.toLowerCase().includes(user.commune.toLowerCase())) {
        score += 3;
      }

      return { ...offre, scoreRelevance: score };
    });

    // Trier par score
    scoredOffres.sort((a, b) => b.scoreRelevance - a.scoreRelevance);

    return {
      criteresUtilises: searchTerms,
      localisationUtilisateur: user?.commune || 'Non renseignée',
      recommandations: scoredOffres.slice(0, 8),
      nombreRecommandations: Math.min(scoredOffres.length, 8),
    };
  }

  // ==================== ANALYSE CV ====================

  async analyserCV(userId: number) {
    const cv = await this.prisma.cV.findUnique({
      where: { userId },
      include: {
        experiences: true,
        formations: true,
      },
    });

    if (!cv) {
      return { error: "L'utilisateur n'a pas de CV" };
    }

    const analyse = {
      completude: 0,
      pointsForts: [] as string[],
      pointsAmeliorer: [] as string[],
      conseils: [] as string[],
    };

    // Calculer la complétude
    let champRemplis = 0;
    const totalChamps = 10;

    if (cv.titreProfessionnel) { champRemplis++; analyse.pointsForts.push('Titre professionnel renseigné'); }
    else analyse.pointsAmeliorer.push('Ajouter un titre professionnel');

    if (cv.resume) { champRemplis++; analyse.pointsForts.push('Résumé présent'); }
    else analyse.pointsAmeliorer.push('Ajouter un résumé de votre profil');

    if (cv.telephone) champRemplis++;
    else analyse.pointsAmeliorer.push('Ajouter votre numéro de téléphone');

    if (cv.competences?.length >= 3) { champRemplis++; analyse.pointsForts.push(`${cv.competences.length} compétences listées`); }
    else analyse.pointsAmeliorer.push('Ajouter plus de compétences (minimum 3)');

    if (cv.langues?.length >= 1) { champRemplis++; analyse.pointsForts.push(`${cv.langues.length} langue(s) renseignée(s)`); }
    else analyse.pointsAmeliorer.push('Ajouter vos langues parlées');

    if (cv.experiences?.length >= 1) { champRemplis++; analyse.pointsForts.push(`${cv.experiences.length} expérience(s) professionnelle(s)`); }
    else analyse.pointsAmeliorer.push('Ajouter au moins une expérience professionnelle');

    if (cv.formations?.length >= 1) { champRemplis++; analyse.pointsForts.push(`${cv.formations.length} formation(s)`); }
    else analyse.pointsAmeliorer.push('Ajouter votre parcours de formation');

    if (cv.linkedin) { champRemplis++; analyse.pointsForts.push('Profil LinkedIn lié'); }
    else analyse.conseils.push('Ajouter votre profil LinkedIn pour plus de visibilité');

    if (cv.certifications?.length >= 1) { champRemplis++; analyse.pointsForts.push(`${cv.certifications.length} certification(s)`); }
    else analyse.conseils.push('Les certifications valorisent votre profil');

    if (cv.interets?.length >= 1) champRemplis++;

    analyse.completude = Math.round((champRemplis / totalChamps) * 100);

    // Conseils généraux
    if (analyse.completude < 50) {
      analyse.conseils.push('Votre CV est incomplet. Prenez le temps de le compléter pour maximiser vos chances.');
    } else if (analyse.completude < 80) {
      analyse.conseils.push('Bon début ! Quelques ajouts rendront votre CV plus attractif.');
    } else {
      analyse.conseils.push('Excellent ! Votre CV est bien rempli. Pensez à le mettre à jour régulièrement.');
    }

    return analyse;
  }

  /* ================== FICHE COMPLÈTE ET RECHERCHE FINE ================== */

  /**
   * Fiche complète d'une offre.
   *
   * Les autres outils ne renvoient que des résumés : sans celui-ci, l'assistant
   * ne pouvait pas répondre à « comment postuler ? » ni « quelle est la date
   * limite ? », les deux questions qui viennent après « qu'est-ce qui existe ».
   */
  async getOffreDetails(offreId: number, userId: number) {
    const offre = await this.prisma.offre.findFirst({
      where: { id: offreId, statutModeration: 'PUBLIEE', estBrouillon: false },
      include: {
        typeOffre: { select: { code: true, libelle: true } },
        _count: { select: { likes: true, commentaires: true, retours: true } },
      },
    });

    if (!offre) return { error: 'Offre introuvable ou non publiée' };

    const favori = await this.prisma.favorite.findUnique({
      where: { userId_offreId: { userId, offreId } },
      select: { id: true },
    });

    const jours = offre.dateLimite
      ? Math.ceil(
          (offre.dateLimite.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        )
      : null;

    return {
      id: offre.id,
      titre: offre.titre,
      type: offre.typeOffre?.libelle,
      entreprise: offre.entreprise,
      localisation: offre.localisation,
      secteur: offre.secteur,
      niveauExperience: offre.niveauExperience,
      typeEmploi: offre.typeEmploi,
      teletravail: offre.teletravail,
      nombrePostes: offre.nombrePostes,
      description: offre.description,
      remuneration:
        offre.salaireMin || offre.salaireMax
          ? {
              min: offre.salaireMin,
              max: offre.salaireMax,
              devise: offre.salaireDevise ?? 'FCFA',
              periode: offre.salairePeriode,
            }
          : null,
      candidature: {
        instructions: offre.instructionsCandidature,
        email: offre.emailCandidature,
        lienExterne: offre.url,
        document: offre.documentUrl ? offre.documentName : null,
      },
      datePublication: offre.datePublication,
      dateLimite: offre.dateLimite,
      joursRestants: jours,
      echeanceDepassee: jours !== null && jours < 0,
      dansMesFavoris: Boolean(favori),
      interactions: {
        jaime: offre._count.likes,
        commentaires: offre._count.commentaires,
        retoursDeCandidats: offre._count.retours,
      },
      lien: `/offres/${offre.id}`,
    };
  }

  /**
   * Recherche croisant tous les critères.
   *
   * Les outils par type, secteur ou localisation ne se combinaient pas : à
   * « une formation en informatique à Ziguinchor », l'assistant devait choisir
   * un seul angle et filtrer le reste de tête, ce qu'il faisait mal.
   */
  async rechercheAvancee(criteres: {
    motsCles?: string;
    typeOffre?: string;
    secteur?: string;
    localisation?: string;
    niveauExperience?: string;
    typeEmploi?: string;
    teletravailUniquement?: boolean;
    echeance?: 'ouverte' | 'depassee';
    limite?: number;
  }) {
    const limite = Math.min(Math.max(criteres.limite ?? 15, 1), 40);
    const where: any = {
      statutModeration: 'PUBLIEE',
      estBrouillon: false,
    };
    const et: any[] = [];

    if (criteres.motsCles) {
      et.push({
        OR: [
          { titre: { contains: criteres.motsCles, mode: 'insensitive' } },
          { description: { contains: criteres.motsCles, mode: 'insensitive' } },
          { entreprise: { contains: criteres.motsCles, mode: 'insensitive' } },
        ],
      });
    }
    if (criteres.typeOffre) {
      where.typeOffre = {
        OR: [
          { code: { equals: criteres.typeOffre, mode: 'insensitive' } },
          { libelle: { contains: criteres.typeOffre, mode: 'insensitive' } },
        ],
      };
    }
    if (criteres.secteur) where.secteur = criteres.secteur;
    if (criteres.niveauExperience) {
      where.niveauExperience = criteres.niveauExperience;
    }
    if (criteres.typeEmploi) where.typeEmploi = criteres.typeEmploi;
    if (criteres.localisation) {
      where.localisation = {
        contains: criteres.localisation,
        mode: 'insensitive',
      };
    }
    if (criteres.teletravailUniquement) {
      where.teletravail = { not: null };
    }
    if (criteres.echeance === 'depassee') {
      where.dateLimite = { lt: new Date() };
    } else if (criteres.echeance === 'ouverte') {
      et.push({
        OR: [{ dateLimite: null }, { dateLimite: { gte: new Date() } }],
      });
    }
    if (et.length) where.AND = et;

    const [offres, total] = await Promise.all([
      this.prisma.offre.findMany({
        where,
        take: limite,
        orderBy: [{ estEpinglee: 'desc' }, { datePublication: 'desc' }],
        select: {
          id: true,
          titre: true,
          entreprise: true,
          localisation: true,
          secteur: true,
          niveauExperience: true,
          dateLimite: true,
          extrait: true,
          typeOffre: { select: { libelle: true } },
        },
      }),
      this.prisma.offre.count({ where }),
    ]);

    return {
      criteres,
      total,
      affichees: offres.length,
      offres,
      // Dit explicitement qu'il en reste : sans ce repère, l'assistant
      // présentait quinze résultats comme s'ils étaient tout le catalogue.
      note:
        total > offres.length
          ? `${total - offres.length} autres résultats existent — affinez les critères ou demandez-en davantage.`
          : undefined,
    };
  }

  /** Offres dont la date limite approche, pour ne pas les laisser passer. */
  async getOffresEcheanceProche(jours = 14) {
    const limite = new Date();
    limite.setDate(limite.getDate() + Math.min(Math.max(jours, 1), 90));

    const offres = await this.prisma.offre.findMany({
      where: {
        statutModeration: 'PUBLIEE',
        estBrouillon: false,
        dateLimite: { gte: new Date(), lte: limite },
      },
      orderBy: { dateLimite: 'asc' },
      take: 25,
      select: {
        id: true,
        titre: true,
        entreprise: true,
        localisation: true,
        dateLimite: true,
        typeOffre: { select: { libelle: true } },
      },
    });

    return {
      fenetreEnJours: jours,
      nombreOffres: offres.length,
      offres: offres.map((offre) => ({
        ...offre,
        joursRestants: Math.ceil(
          (offre.dateLimite!.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      })),
    };
  }

  /* ========================= CONFRONTER AU PROFIL ======================== */

  /**
   * Confronte le CV à une offre : ce qui colle, ce qui manque.
   *
   * L'assistant savait lister des offres et lire un CV, mais pas les mettre
   * face à face — c'est pourtant la question réelle : « est-ce que je peux
   * postuler, et que dois-je travailler ? »
   */
  async comparerProfilOffre(userId: number, offreId: number) {
    const [cv, offre, user] = await Promise.all([
      this.prisma.cV.findUnique({
        where: { userId },
        select: {
          competences: true,
          titreProfessionnel: true,
          experiences: { select: { poste: true, entreprise: true } },
          formations: { select: { diplome: true, etablissement: true } },
        },
      }),
      this.prisma.offre.findFirst({
        where: { id: offreId, statutModeration: 'PUBLIEE' },
        select: {
          id: true,
          titre: true,
          description: true,
          localisation: true,
          secteur: true,
          niveauExperience: true,
          dateLimite: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { region: true, commune: true },
      }),
    ]);

    if (!offre) return { error: 'Offre introuvable' };
    if (!cv) {
      return {
        error:
          "L'utilisateur n'a pas encore de CV : impossible de comparer. Proposez-lui d'en créer un.",
      };
    }

    const texte = `${offre.titre} ${offre.description}`.toLowerCase();
    const competences = cv.competences ?? [];

    const presentes = competences.filter((competence) =>
      texte.includes(competence.toLowerCase()),
    );

    // Les mots de l'annonce qui ressemblent à des compétences et que le CV ne
    // mentionne pas. Approximation assumée : c'est une piste de travail
    // proposée à la personne, pas un verdict — d'où le filtrage du vocabulaire
    // de recrutement, qui reviendrait sinon à annoncer qu'il « manque » les
    // mots « recrute » ou « candidature ».
    const motsOffre = [
      ...new Set(
        texte
          .replace(/[^a-zà-ÿ0-9+#. ]/gi, ' ')
          .split(/\s+/)
          .filter((mot) => mot.length > 4 && !MOTS_VIDES.has(sansAccents(mot))),
      ),
    ];
    const dejaConnus = new Set(
      competences.flatMap((c) => c.toLowerCase().split(/\s+/)),
    );

    const nombreAnnees = cv.experiences.length;

    const memeRegion =
      user?.region && offre.localisation
        ? offre.localisation.toLowerCase().includes(user.region.toLowerCase())
        : null;

    return {
      offre: {
        id: offre.id,
        titre: offre.titre,
        niveauAttendu: offre.niveauExperience,
        secteur: offre.secteur,
        localisation: offre.localisation,
        dateLimite: offre.dateLimite,
      },
      profil: {
        titre: cv.titreProfessionnel,
        nombreExperiences: nombreAnnees,
        nombreFormations: cv.formations.length,
        competences,
      },
      correspondance: {
        competencesRetrouveesDansLAnnonce: presentes,
        tauxCompetences: competences.length
          ? Math.round((presentes.length / competences.length) * 100)
          : 0,
        memeRegion,
        motsClesDeLAnnonceAbsentsDuCV: motsOffre
          .filter((mot) => !dejaConnus.has(mot))
          .slice(0, 25),
      },
      // Ce champ dit à l'assistant quoi faire de ce qui précède : sans
      // consigne, il récitait les listes au lieu de conseiller.
      consigne:
        "Formule une réponse courte : les points forts d'abord, puis deux ou trois manques à combler, puis une suggestion concrète (formation du catalogue, ajout au CV). Ne recopie pas les listes brutes.",
    };
  }

  /* ============================== RÉFÉRENTIELS ========================== */

  /**
   * Valeurs acceptées par les filtres.
   *
   * Sans cette liste, l'assistant inventait des secteurs (« NUMERIQUE ») qui ne
   * renvoyaient jamais rien, et concluait que le catalogue était vide.
   */
  async getReferentiels() {
    const [types, secteurs, regions] = await Promise.all([
      this.prisma.typeOffre.findMany({
        where: { estActif: true },
        select: { code: true, libelle: true },
        orderBy: { ordre: 'asc' },
      }),
      this.prisma.offre.groupBy({
        by: ['secteur'],
        where: { statutModeration: 'PUBLIEE', secteur: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.offre.groupBy({
        by: ['localisation'],
        where: { statutModeration: 'PUBLIEE', localisation: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { localisation: 'desc' } },
        take: 25,
      }),
    ]);

    return {
      typesOffre: types,
      secteurs: secteurs
        .map((s) => ({ valeur: s.secteur, nombreOffres: s._count._all }))
        .sort((a, b) => b.nombreOffres - a.nombreOffres),
      niveauxExperience: [
        'DEBUTANT',
        'JUNIOR',
        'CONFIRME',
        'SENIOR',
        'EXPERT',
      ],
      typesEmploi: [
        'CDI',
        'CDD',
        'STAGE',
        'ALTERNANCE',
        'FREELANCE',
        'INTERIM',
        'SAISONNIER',
        'TEMPS_PARTIEL',
        'TEMPS_PLEIN',
      ],
      localisationsFrequentes: regions.map((r) => ({
        valeur: r.localisation,
        nombreOffres: r._count._all,
      })),
    };
  }

  /** Structures partenaires qui publient sur la plateforme. */
  async getEntreprisesPartenaires() {
    const entreprises = await this.prisma.entreprisePartenaire.findMany({
      where: { estVisibleVitrine: true },
      orderBy: { ordreVitrine: 'asc' },
      select: {
        id: true,
        nom: true,
        secteur: true,
        description: true,
        siteWeb: true,
        ville: true,
        region: true,
      },
      take: 30,
    });

    return { nombre: entreprises.length, entreprises };
  }

  /** Retours laissés par des candidats sur une offre. */
  async getRetoursOffre(offreId: number) {
    const retours = await this.prisma.retour.findMany({
      where: { offreId },
      orderBy: { datePublication: 'desc' },
      take: 10,
      select: {
        contenu: true,
        datePublication: true,
        auteur: { select: { firstName: true, lastName: true } },
      },
    });

    return { offreId, nombreRetours: retours.length, retours };
  }

  /* ================================ ACTIONS ============================= */

  /**
   * Enregistre une offre dans les favoris de la personne.
   *
   * Seules les actions réversibles et portant sur ses propres données sont
   * confiées à l'assistant : mettre en favori s'annule d'un geste, postuler
   * non — c'est pourquoi la candidature n'en fait pas partie.
   */
  async ajouterFavori(userId: number, offreId: number) {
    const offre = await this.prisma.offre.findFirst({
      where: { id: offreId, statutModeration: 'PUBLIEE' },
      select: { id: true, titre: true },
    });
    if (!offre) return { error: 'Offre introuvable' };

    await this.prisma.favorite.upsert({
      where: { userId_offreId: { userId, offreId } },
      update: {},
      create: { userId, offreId },
    });

    return { succes: true, message: `« ${offre.titre} » ajoutée aux favoris.` };
  }

  async retirerFavori(userId: number, offreId: number) {
    const supprime = await this.prisma.favorite.deleteMany({
      where: { userId, offreId },
    });

    return supprime.count > 0
      ? { succes: true, message: 'Offre retirée des favoris.' }
      : { succes: false, message: "Cette offre n'était pas dans les favoris." };
  }

  /** Alerte enregistrée : la personne sera prévenue des offres qui collent. */
  async creerAlerte(
    userId: number,
    criteres: {
      motsCles?: string;
      typeOffre?: string;
      secteur?: string;
      localisation?: string;
    },
  ) {
    const propres = Object.fromEntries(
      Object.entries(criteres).filter(([, valeur]) => Boolean(valeur)),
    );

    if (Object.keys(propres).length === 0) {
      return {
        error:
          'Une alerte sans critère préviendrait de tout : demandez au moins un mot-clé, un type ou une localisation.',
      };
    }

    const existante = await this.prisma.alert.findFirst({
      where: { userId, isActive: true, criteria: { equals: propres } },
    });
    if (existante) {
      return { succes: false, message: 'Cette alerte existe déjà.' };
    }

    const alerte = await this.prisma.alert.create({
      data: { userId, criteria: propres },
    });

    return {
      succes: true,
      id: alerte.id,
      message: 'Alerte enregistrée. Vous serez prévenu des nouvelles offres correspondantes.',
      criteres: propres,
    };
  }

  /** Alertes déjà enregistrées. */
  async getMesAlertes(userId: number) {
    const alertes = await this.prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, criteria: true, isActive: true, createdAt: true },
    });

    return { nombre: alertes.length, alertes };
  }
}
