import { Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common';

const offresData = [
  // EMPLOIS - Ziguinchor
  {
    titre: "Développeur Web Full Stack",
    description: "Nous recherchons un développeur web full stack pour rejoindre notre équipe dynamique à Ziguinchor. Vous serez responsable du développement et de la maintenance de nos applications web. Compétences requises : React, Node.js, PostgreSQL. Environnement de travail moderne et équipe jeune et motivée.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDI",
    secteur: "INFORMATIQUE",
    niveauExperience: "JUNIOR",
    localisation: "Ziguinchor, Casamance",
    entreprise: "Tech Casamance SARL",
    salaireMin: 350000,
    salaireMax: 500000,
    devise: "FCFA",
    tags: ["React", "Node.js", "PostgreSQL", "JavaScript"],
  },
  {
    titre: "Comptable Senior",
    description: "Cabinet comptable basé à Ziguinchor recherche un comptable senior avec minimum 5 ans d'expérience. Gestion de la comptabilité clients, établissement des bilans et déclarations fiscales. Maîtrise de SAGE et Excel indispensable.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDI",
    secteur: "FINANCE",
    niveauExperience: "CONFIRME",
    localisation: "Ziguinchor, Casamance",
    entreprise: "Cabinet Diatta & Associés",
    salaireMin: 400000,
    salaireMax: 600000,
    devise: "FCFA",
    tags: ["Comptabilité", "SAGE", "Fiscalité", "Excel"],
  },
  {
    titre: "Commercial Terrain - Agroalimentaire",
    description: "Entreprise leader dans l'agroalimentaire recherche des commerciaux terrain pour développer notre réseau de distribution en Casamance. Véhicule de fonction fourni. Primes sur objectifs attractives.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDI",
    secteur: "COMMERCE",
    niveauExperience: "JUNIOR",
    localisation: "Ziguinchor et région",
    entreprise: "Casamance Agro Distribution",
    salaireMin: 200000,
    salaireMax: 350000,
    devise: "FCFA",
    tags: ["Vente", "Commercial", "Agroalimentaire", "Terrain"],
  },
  {
    titre: "Infirmier(ère) Diplômé(e) d'État",
    description: "Clinique privée à Ziguinchor recrute un(e) infirmier(ère) diplômé(e) d'État. Poste en CDI avec possibilité de gardes. Expérience en soins généraux souhaitée. Ambiance de travail conviviale.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDI",
    secteur: "SANTE",
    niveauExperience: "JUNIOR",
    localisation: "Ziguinchor, Casamance",
    entreprise: "Clinique Casamance Santé",
    salaireMin: 250000,
    salaireMax: 400000,
    devise: "FCFA",
    tags: ["Santé", "Soins", "Infirmier", "Médical"],
  },
  {
    titre: "Responsable Marketing Digital",
    description: "Agence de communication digitale recherche un responsable marketing digital pour gérer les campagnes de nos clients. Expertise en SEO, réseaux sociaux et publicité en ligne requise. Poste basé à Ziguinchor avec déplacements occasionnels à Dakar.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDI",
    secteur: "MARKETING",
    niveauExperience: "CONFIRME",
    localisation: "Ziguinchor, Casamance",
    entreprise: "Digital Casamance Agency",
    salaireMin: 400000,
    salaireMax: 650000,
    devise: "FCFA",
    tags: ["Marketing Digital", "SEO", "Réseaux Sociaux", "Google Ads"],
  },
  {
    titre: "Réceptionniste Bilingue - Hôtellerie",
    description: "Hôtel 4 étoiles au Cap Skirring recherche un(e) réceptionniste bilingue français/anglais. Accueil des clients internationaux, gestion des réservations. Expérience en hôtellerie de luxe appréciée.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDI",
    secteur: "TOURISME",
    niveauExperience: "JUNIOR",
    localisation: "Cap Skirring, Casamance",
    entreprise: "Hôtel Les Palétuviers",
    salaireMin: 180000,
    salaireMax: 280000,
    devise: "FCFA",
    tags: ["Hôtellerie", "Tourisme", "Accueil", "Bilingue"],
  },
  {
    titre: "Chef Cuisinier - Restaurant Gastronomique",
    description: "Restaurant gastronomique au Cap Skirring recherche un chef cuisinier créatif. Cuisine fusion africaine et internationale. Gestion d'une équipe de 5 personnes. Logement possible sur place.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDI",
    secteur: "TOURISME",
    niveauExperience: "CONFIRME",
    localisation: "Cap Skirring, Casamance",
    entreprise: "Restaurant La Casamançaise",
    salaireMin: 350000,
    salaireMax: 550000,
    devise: "FCFA",
    tags: ["Cuisine", "Gastronomie", "Chef", "Restaurant"],
  },
  {
    titre: "Guide Touristique - Écotourisme",
    description: "Agence d'écotourisme recherche des guides passionnés par la nature et la culture casamançaise. Accompagnement de groupes dans les bolongs, forêts et villages traditionnels. Formation assurée.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDD",
    secteur: "TOURISME",
    niveauExperience: "DEBUTANT",
    localisation: "Oussouye, Casamance",
    entreprise: "Casamance Éco-Tours",
    salaireMin: 150000,
    salaireMax: 250000,
    devise: "FCFA",
    tags: ["Tourisme", "Écotourisme", "Guide", "Nature"],
  },
  {
    titre: "Technicien Agricole",
    description: "ONG internationale recherche un technicien agricole pour accompagner les producteurs de la région de Kolda. Formation des agriculteurs aux techniques durables, suivi des parcelles. Déplacements fréquents en zone rurale.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDD",
    secteur: "AGRICULTURE",
    niveauExperience: "JUNIOR",
    localisation: "Kolda, Casamance",
    entreprise: "ONG Agri-Développement",
    salaireMin: 280000,
    salaireMax: 400000,
    devise: "FCFA",
    tags: ["Agriculture", "Développement", "Formation", "Rural"],
  },
  {
    titre: "Gestionnaire de Projet - Microfinance",
    description: "Institution de microfinance recherche un gestionnaire de projet pour développer nos activités à Sédhiou. Gestion du portefeuille clients, analyse des dossiers de crédit, accompagnement des entrepreneurs.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDI",
    secteur: "FINANCE",
    niveauExperience: "CONFIRME",
    localisation: "Sédhiou, Casamance",
    entreprise: "Casamance Microfinance",
    salaireMin: 350000,
    salaireMax: 500000,
    devise: "FCFA",
    tags: ["Microfinance", "Crédit", "Gestion", "Entrepreneuriat"],
  },
  {
    titre: "Ingénieur Génie Civil",
    description: "Bureau d'études à Dakar recrute un ingénieur génie civil. Projets d'infrastructure en Casamance et dans tout le Sénégal. Déplacements réguliers sur les chantiers. Expérience BTP souhaitée.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDI",
    secteur: "BTP",
    niveauExperience: "CONFIRME",
    localisation: "Dakar (projets en Casamance)",
    entreprise: "BET Sénégal Ingénierie",
    salaireMin: 600000,
    salaireMax: 900000,
    devise: "FCFA",
    tags: ["Génie Civil", "BTP", "Infrastructure", "Ingénieur"],
  },
  {
    titre: "Chargé(e) de Communication",
    description: "ONG basée à Dakar recherche un(e) chargé(e) de communication pour valoriser ses projets en Casamance. Création de contenus, relations presse, gestion des réseaux sociaux. Déplacements en Casamance.",
    typeOffre: "EMPLOI",
    typeEmploi: "CDI",
    secteur: "MARKETING",
    niveauExperience: "JUNIOR",
    localisation: "Dakar",
    entreprise: "ONG Solidarité Casamance",
    salaireMin: 300000,
    salaireMax: 450000,
    devise: "FCFA",
    tags: ["Communication", "ONG", "Réseaux Sociaux", "Rédaction"],
  },
  {
    titre: "Stage - Assistant(e) Administratif(ve)",
    description: "Entreprise de transport à Ziguinchor offre un stage de 6 mois en administration. Gestion du courrier, accueil téléphonique, classement. Possibilité d'embauche à l'issue du stage.",
    typeOffre: "EMPLOI",
    typeEmploi: "STAGE",
    secteur: "TRANSPORT",
    niveauExperience: "DEBUTANT",
    localisation: "Ziguinchor, Casamance",
    entreprise: "Trans Casamance Express",
    salaireMin: 75000,
    salaireMax: 100000,
    devise: "FCFA",
    tags: ["Stage", "Administration", "Secrétariat", "Transport"],
  },
  {
    titre: "Stage - Développeur Mobile",
    description: "Startup tech à Ziguinchor recherche un stagiaire développeur mobile (Flutter ou React Native). Projet innovant dans le domaine de l'agriculture. Encadrement par un développeur senior.",
    typeOffre: "EMPLOI",
    typeEmploi: "STAGE",
    secteur: "INFORMATIQUE",
    niveauExperience: "DEBUTANT",
    localisation: "Ziguinchor, Casamance",
    entreprise: "AgriTech Casamance",
    salaireMin: 100000,
    salaireMax: 150000,
    devise: "FCFA",
    tags: ["Stage", "Mobile", "Flutter", "React Native", "Startup"],
  },
  {
    titre: "Stage - Community Manager",
    description: "Agence de voyage recherche un stagiaire community manager pour animer nos réseaux sociaux et promouvoir le tourisme en Casamance. Créativité et passion pour les réseaux sociaux requises.",
    typeOffre: "EMPLOI",
    typeEmploi: "STAGE",
    secteur: "MARKETING",
    niveauExperience: "DEBUTANT",
    localisation: "Ziguinchor, Casamance",
    entreprise: "Casamance Voyages",
    salaireMin: 80000,
    salaireMax: 120000,
    devise: "FCFA",
    tags: ["Stage", "Community Manager", "Réseaux Sociaux", "Tourisme"],
  },
  // FORMATIONS
  {
    titre: "Formation en Développement Web - 6 mois",
    description: "Formation intensive en développement web : HTML, CSS, JavaScript, React, Node.js. 6 mois de formation pratique avec projet final. Accompagnement à l'insertion professionnelle. Places limitées à 20 participants.",
    typeOffre: "FORMATION",
    localisation: "Ziguinchor, Casamance",
    organisme: "Centre de Formation Numérique Casamance",
    dureeFormation: 180,
    certification: "Certificat de Développeur Web Full Stack",
    tags: ["Développement Web", "JavaScript", "React", "Formation"],
  },
  {
    titre: "Formation en Gestion d'Entreprise - 3 mois",
    description: "Formation pour entrepreneurs et porteurs de projets. Comptabilité de base, marketing, gestion des ressources humaines, business plan. Idéal pour créer ou développer son entreprise en Casamance.",
    typeOffre: "FORMATION",
    localisation: "Ziguinchor, Casamance",
    organisme: "Chambre de Commerce de Ziguinchor",
    dureeFormation: 90,
    certification: "Attestation de Formation en Gestion d'Entreprise",
    tags: ["Entrepreneuriat", "Gestion", "Business", "Formation"],
  },
  {
    titre: "Formation en Agriculture Biologique",
    description: "Apprenez les techniques de l'agriculture biologique adaptées au climat casamançais. Culture maraîchère, compostage, gestion de l'eau. Formation pratique sur exploitation agricole.",
    typeOffre: "FORMATION",
    localisation: "Oussouye, Casamance",
    organisme: "Ferme École Bio Casamance",
    dureeFormation: 30,
    certification: "Certificat en Agriculture Biologique",
    tags: ["Agriculture", "Bio", "Maraîchage", "Écologie"],
  },
  {
    titre: "Formation en Anglais Professionnel",
    description: "Cours d'anglais professionnel pour améliorer vos opportunités dans le tourisme et le commerce international. Niveaux débutant à avancé. Cours du soir et week-end disponibles.",
    typeOffre: "FORMATION",
    localisation: "Ziguinchor, Casamance",
    organisme: "English Academy Ziguinchor",
    dureeFormation: 120,
    certification: "Certificat d'Anglais Professionnel",
    tags: ["Anglais", "Langues", "Professionnel", "Communication"],
  },
  {
    titre: "Formation en Couture et Mode",
    description: "Formation complète en couture : prise de mesures, patronage, confection. Spécialisation possible en mode africaine traditionnelle et moderne. Machines à coudre fournies pendant la formation.",
    typeOffre: "FORMATION",
    localisation: "Ziguinchor, Casamance",
    organisme: "Atelier Mode Casamance",
    dureeFormation: 180,
    certification: "Diplôme de Couturier(ère) Professionnel(le)",
    tags: ["Couture", "Mode", "Artisanat", "Création"],
  },
  {
    titre: "Formation en Électricité Bâtiment",
    description: "Formation aux métiers de l'électricité : installation électrique, dépannage, normes de sécurité. Débouchés garantis dans le secteur du BTP en pleine expansion en Casamance.",
    typeOffre: "FORMATION",
    localisation: "Ziguinchor, Casamance",
    organisme: "Centre de Formation Professionnelle de Ziguinchor",
    dureeFormation: 240,
    certification: "CAP Électricien Bâtiment",
    tags: ["Électricité", "BTP", "Technique", "Installation"],
  },
  {
    titre: "Formation en Transformation Agroalimentaire",
    description: "Apprenez à transformer les produits locaux : jus de fruits, confitures, séchage de poissons et fruits. Normes d'hygiène et conditionnement. Idéal pour créer votre micro-entreprise.",
    typeOffre: "FORMATION",
    localisation: "Kolda, Casamance",
    organisme: "Institut de Technologie Alimentaire - Antenne Kolda",
    dureeFormation: 60,
    certification: "Attestation en Transformation Agroalimentaire",
    tags: ["Agroalimentaire", "Transformation", "Entrepreneuriat", "Local"],
  },
  // BOURSES
  {
    titre: "Bourse d'Excellence - Master en France",
    description: "Bourse complète pour étudiants sénégalais souhaitant poursuivre un Master en France. Couvre les frais de scolarité, le logement et une allocation mensuelle. Priorité aux candidats de régions défavorisées.",
    typeOffre: "BOURSE",
    localisation: "France",
    paysBourse: "France",
    niveauEtude: "Master",
    montantBourse: 12000000,
    estRemboursable: false,
    tags: ["Bourse", "France", "Master", "Excellence"],
  },
  {
    titre: "Bourse Campus France - Licence",
    description: "Programme de bourses pour étudiants sénégalais en Licence. Études en France dans les domaines scientifiques et techniques. Accompagnement administratif et linguistique inclus.",
    typeOffre: "BOURSE",
    localisation: "France",
    paysBourse: "France",
    niveauEtude: "Licence",
    montantBourse: 8000000,
    estRemboursable: false,
    tags: ["Bourse", "France", "Licence", "Sciences"],
  },
  {
    titre: "Bourse DAAD - Études en Allemagne",
    description: "Le DAAD offre des bourses pour des études de Master et Doctorat en Allemagne. Domaines : ingénierie, sciences, économie. Cours d'allemand intensif inclus avant le début des études.",
    typeOffre: "BOURSE",
    localisation: "Allemagne",
    paysBourse: "Allemagne",
    niveauEtude: "Master/Doctorat",
    montantBourse: 15000000,
    estRemboursable: false,
    tags: ["Bourse", "Allemagne", "DAAD", "Ingénierie"],
  },
  {
    titre: "Bourse Maroc - Formation Professionnelle",
    description: "Bourses du Royaume du Maroc pour formations professionnelles et techniques. Durée 2 ans. Secteurs : agriculture, tourisme, artisanat. Logement et restauration pris en charge.",
    typeOffre: "BOURSE",
    localisation: "Maroc",
    paysBourse: "Maroc",
    niveauEtude: "Formation Professionnelle",
    montantBourse: 3000000,
    estRemboursable: false,
    tags: ["Bourse", "Maroc", "Formation", "Technique"],
  },
  {
    titre: "Bourse Tunisie - Études Universitaires",
    description: "Programme de coopération Sénégal-Tunisie offrant des bourses pour études universitaires. Tous domaines confondus. Frais de scolarité et allocation mensuelle couverts.",
    typeOffre: "BOURSE",
    localisation: "Tunisie",
    paysBourse: "Tunisie",
    niveauEtude: "Licence/Master",
    montantBourse: 4500000,
    estRemboursable: false,
    tags: ["Bourse", "Tunisie", "Université", "Coopération"],
  },
  {
    titre: "Bourse Locale - Étudiants Casamançais",
    description: "Bourse régionale pour étudiants originaires de Casamance poursuivant des études supérieures au Sénégal. Aide financière pour frais de scolarité et logement. Dossier à déposer à la mairie.",
    typeOffre: "BOURSE",
    localisation: "Sénégal",
    paysBourse: "Sénégal",
    niveauEtude: "Licence/Master",
    montantBourse: 500000,
    estRemboursable: false,
    tags: ["Bourse", "Locale", "Casamance", "Sénégal"],
  },
  {
    titre: "Bourse Canada - Programme Études-Travail",
    description: "Bourse partielle pour études au Canada avec permis de travail. Possibilité de travailler 20h/semaine pendant les études. Domaines : informatique, santé, commerce.",
    typeOffre: "BOURSE",
    localisation: "Canada",
    paysBourse: "Canada",
    niveauEtude: "Licence/Master",
    montantBourse: 10000000,
    estRemboursable: false,
    tags: ["Bourse", "Canada", "Études-Travail", "Immigration"],
  },
];

@ApiTags('Admin - Seed')
@Controller('api/admin/seed')
export class SeedOffresController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Post('offres')
  @ApiOperation({ summary: 'Créer les offres fictives pour le Sénégal/Casamance' })
  async seedOffres() {
    // Trouver un admin
    let admin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!admin) {
      return { success: false, message: 'Aucun admin trouvé' };
    }

    let created = 0;
    for (const offre of offresData) {
      try {
        await this.prisma.offre.create({
          data: {
            ...offre,
            auteurId: admin.id,
            datePublication: new Date(),
            dateLimite: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          } as any,
        });
        created++;
      } catch (error) {
        console.error(`Erreur création offre "${offre.titre}":`, error);
      }
    }

    return {
      success: true,
      message: `${created} offres créées sur ${offresData.length}`,
      total: created,
    };
  }

  @Public()
  @Post('update-urls')
  @ApiOperation({ summary: 'Mettre à jour les URLs des offres' })
  async updateOffresUrls() {
    const urlMappings: Record<string, string> = {
      "Développeur Web Full Stack": "https://www.emploisenegal.com/offre/developpeur-web-fullstack",
      "Comptable Senior": "https://www.emploisenegal.com/offre/comptable-senior",
      "Commercial Terrain - Agroalimentaire": "https://www.emploisenegal.com/offre/commercial-terrain",
      "Infirmier(ère) Diplômé(e) d'État": "https://www.emploisenegal.com/offre/infirmier-diplome",
      "Responsable Marketing Digital": "https://www.emploisenegal.com/offre/responsable-marketing-digital",
      "Réceptionniste Bilingue - Hôtellerie": "https://www.emploisenegal.com/offre/receptionniste-bilingue",
      "Chef Cuisinier - Restaurant Gastronomique": "https://www.emploisenegal.com/offre/chef-cuisinier",
      "Technicien Agricole": "https://www.emploisenegal.com/offre/technicien-agricole",
      "Électricien Bâtiment": "https://www.emploisenegal.com/offre/electricien-batiment",
      "Enseignant(e) de Mathématiques": "https://www.emploisenegal.com/offre/enseignant-mathematiques",
      "Formation en Développement Web - 6 mois": "https://www.formationsenegal.com/formation/developpement-web",
      "Formation Gestion de Projet - PMP": "https://www.formationsenegal.com/formation/gestion-projet-pmp",
      "Formation en Comptabilité et Gestion": "https://www.formationsenegal.com/formation/comptabilite-gestion",
      "Formation en Agriculture Biologique": "https://www.formationsenegal.com/formation/agriculture-biologique",
      "Formation Guide Touristique": "https://www.formationsenegal.com/formation/guide-touristique",
      "Bourse d'Excellence - Master en France": "https://www.campusfrance.org/fr/bourses-excellence",
      "Bourse de Recherche Doctorale - ANSTS": "https://www.ansts.sn/bourses-recherche",
      "Bourse Entrepreneuriat Jeunes Casamance": "https://www.fondation-casamance.org/bourses",
      "Bourse Formation Professionnelle - BIT": "https://www.ilo.org/senegal/bourses",
      "Bourse Mobilité Étudiante - CEDEAO": "https://www.ecowas.int/education/mobility",
      "Chauffeur Poids Lourd": "https://www.emploisenegal.com/offre/chauffeur-poids-lourd",
      "Assistant(e) Administratif(ve)": "https://www.emploisenegal.com/offre/assistant-administratif",
      "Menuisier Ébéniste": "https://www.emploisenegal.com/offre/menuisier-ebeniste",
      "Gestionnaire de Stock": "https://www.emploisenegal.com/offre/gestionnaire-stock",
      "Technicien Maintenance Informatique": "https://www.emploisenegal.com/offre/technicien-maintenance-informatique",
      "Stage - Community Manager": "https://www.emploisenegal.com/offre/stage-community-manager",
      "Avocat Junior - Cabinet d'Affaires": "https://www.emploisenegal.com/offre/avocat-junior",
      "Responsable RH": "https://www.emploisenegal.com/offre/responsable-rh",
      "Pêcheur Professionnel": "https://www.emploisenegal.com/offre/pecheur-professionnel",
      "Technicien Énergie Solaire": "https://www.emploisenegal.com/offre/technicien-energie-solaire",
    };

    const offres = await this.prisma.offre.findMany();
    let updated = 0;

    for (const offre of offres) {
      let url = urlMappings[offre.titre];
      
      if (!url) {
        // Generate URL based on type
        let baseUrl = 'https://www.emploisenegal.com/offre/';
        if (offre.typeOffre === 'FORMATION') {
          baseUrl = 'https://www.formationsenegal.com/formation/';
        } else if (offre.typeOffre === 'BOURSE') {
          baseUrl = 'https://www.bourses-senegal.org/bourse/';
        }
        
        const slug = offre.titre.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        
        url = baseUrl + slug;
      }

      if (!offre.url) {
        await this.prisma.offre.update({
          where: { id: offre.id },
          data: { url },
        });
        updated++;
      }
    }

    return {
      success: true,
      message: `${updated} offres mises à jour avec des URLs`,
      total: updated,
    };
  }
}
