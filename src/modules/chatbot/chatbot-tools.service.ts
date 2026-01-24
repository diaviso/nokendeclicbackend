import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
        commune: user.commune || 'Non renseigné',
        quartier: user.quartier || 'Non renseigné',
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
        typeOffre: true,
        entreprise: true,
        localisation: true,
        salaireMin: true,
        salaireMax: true,
        devise: true,
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
        typeOffre: true,
        entreprise: true,
        localisation: true,
        niveauExperience: true,
        salaireMin: true,
        salaireMax: true,
        devise: true,
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
        localisation: { contains: localisation, mode: 'insensitive' },
      },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        typeOffre: true,
        entreprise: true,
        localisation: true,
        salaireMin: true,
        salaireMax: true,
        devise: true,
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
      where: { typeOffre: typeOffre as any },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        typeOffre: true,
        entreprise: true,
        localisation: true,
        secteur: true,
        salaireMin: true,
        salaireMax: true,
        devise: true,
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
      where: { secteur: secteur as any },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        typeOffre: true,
        entreprise: true,
        localisation: true,
        niveauExperience: true,
        salaireMin: true,
        salaireMax: true,
        devise: true,
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
        typeOffre: true,
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
            typeOffre: true,
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
            typeOffre: true,
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
      this.prisma.offre.count(),
      this.prisma.offre.groupBy({
        by: ['typeOffre'],
        _count: { typeOffre: true },
      }),
      this.prisma.offre.groupBy({
        by: ['secteur'],
        _count: { secteur: true },
        orderBy: { _count: { secteur: 'desc' } },
        take: 10,
      }),
      this.prisma.offre.groupBy({
        by: ['localisation'],
        _count: { localisation: true },
        orderBy: { _count: { localisation: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalOffres: total,
      parType: parType.map((t) => ({ type: t.typeOffre, count: t._count.typeOffre })),
      topSecteurs: parSecteur.map((s) => ({ secteur: s.secteur, count: s._count.secteur })),
      topLocalisations: parLocalisation.map((l) => ({ localisation: l.localisation, count: l._count.localisation })),
    };
  }

  async getFormationsDisponibles() {
    const formations = await this.prisma.offre.findMany({
      where: { typeOffre: 'FORMATION' },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        organisme: true,
        dureeFormation: true,
        certification: true,
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
      where: { typeOffre: 'BOURSE' },
      take: 15,
      orderBy: { datePublication: 'desc' },
      select: {
        id: true,
        titre: true,
        paysBourse: true,
        niveauEtude: true,
        montantBourse: true,
        estRemboursable: true,
        localisation: true,
        description: true,
      },
    });

    return {
      bourses,
      nombreBourses: bourses.length,
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
        typeOffre: true,
        entreprise: true,
        localisation: true,
        secteur: true,
        niveauExperience: true,
        salaireMin: true,
        salaireMax: true,
        devise: true,
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
}
