import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

async function main() {
  console.log('🔄 Mise à jour des URLs des offres...');
  
  const offres = await prisma.offre.findMany();
  let updated = 0;
  
  for (const offre of offres) {
    const url = urlMappings[offre.titre];
    if (url && !offre.url) {
      await prisma.offre.update({
        where: { id: offre.id },
        data: { url },
      });
      updated++;
      console.log(`✅ ${offre.titre} -> ${url}`);
    }
  }
  
  // Update any remaining offres without URLs with a generic URL based on type
  const offresWithoutUrl = await prisma.offre.findMany({
    where: { url: null },
  });
  
  for (const offre of offresWithoutUrl) {
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
    
    await prisma.offre.update({
      where: { id: offre.id },
      data: { url: baseUrl + slug },
    });
    updated++;
    console.log(`✅ ${offre.titre} -> ${baseUrl + slug}`);
  }
  
  console.log(`\n✅ ${updated} offres mises à jour avec des URLs!`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
