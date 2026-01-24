import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import * as fs from 'fs';
import { PDFParse } from 'pdf-parse';

export interface ExtractedCV {
  titreProfessionnel?: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  pays?: string;
  linkedin?: string;
  siteWeb?: string;
  github?: string;
  resume?: string;
  competences: string[];
  langues: string[];
  certifications: string[];
  interets: string[];
  experiences: {
    poste: string;
    entreprise: string;
    ville?: string;
    dateDebut: string;
    dateFin?: string;
    enCours: boolean;
    description?: string;
  }[];
  formations: {
    diplome: string;
    etablissement: string;
    ville?: string;
    dateDebut: string;
    dateFin?: string;
    enCours: boolean;
    description?: string;
  }[];
}

@Injectable()
export class CVExtractorService {
  private readonly logger = new Logger(CVExtractorService.name);
  private chatModel: ChatOpenAI;

  private readonly systemPrompt = `Tu es un expert en extraction d'informations de CV. 
Ton rôle est d'analyser le texte d'un CV et d'extraire toutes les informations pertinentes de manière structurée.

Tu dois extraire les informations suivantes et les retourner en JSON valide:
- titreProfessionnel: Le titre ou poste actuel/recherché
- telephone: Numéro de téléphone
- adresse: Adresse complète
- ville: Ville
- codePostal: Code postal
- pays: Pays
- linkedin: URL LinkedIn
- siteWeb: Site web personnel
- github: URL GitHub
- resume: Résumé professionnel ou objectif de carrière
- competences: Liste des compétences techniques et soft skills (tableau de strings)
- langues: Liste des langues parlées avec niveau si disponible (tableau de strings, ex: "Français (Natif)", "Anglais (B2)")
- certifications: Liste des certifications (tableau de strings)
- interets: Centres d'intérêt (tableau de strings)
- experiences: Liste des expériences professionnelles avec:
  - poste: Intitulé du poste
  - entreprise: Nom de l'entreprise
  - ville: Ville (optionnel)
  - dateDebut: Date de début au format YYYY-MM-DD (utilise le premier jour du mois si seul le mois est donné)
  - dateFin: Date de fin au format YYYY-MM-DD (null si en cours)
  - enCours: true si c'est le poste actuel
  - description: Description des missions/responsabilités
- formations: Liste des formations avec:
  - diplome: Nom du diplôme
  - etablissement: Nom de l'école/université
  - ville: Ville (optionnel)
  - dateDebut: Date de début au format YYYY-MM-DD
  - dateFin: Date de fin au format YYYY-MM-DD (null si en cours)
  - enCours: true si formation en cours
  - description: Description ou spécialisation

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide, sans texte avant ou après
- Si une information n'est pas trouvée, utilise null pour les strings et [] pour les tableaux
- Les dates doivent être au format YYYY-MM-DD. Si seule l'année est donnée, utilise YYYY-01-01
- Trie les expériences et formations par date de début décroissante (plus récent en premier)`;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY is not configured');
    }

    this.chatModel = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 4000,
    });
  }

  async extractTextFromPDF(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
      throw new Error('Fichier PDF non trouvé');
    }

    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const pdfData = await parser.getText();

    return this.cleanText(pdfData.text || '');
  }

  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/^\s+|\s+$/gm, '')
      .trim();
  }

  async extractCVData(pdfText: string): Promise<ExtractedCV> {
    try {
      const messages = [
        new SystemMessage(this.systemPrompt),
        new HumanMessage(`Voici le contenu du CV à analyser:\n\n${pdfText}`),
      ];

      const response = await this.chatModel.invoke(messages);
      const content = response.content as string;

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Impossible de parser la réponse JSON');
      }

      const extractedData = JSON.parse(jsonMatch[0]) as ExtractedCV;

      // Ensure arrays are initialized
      return {
        ...extractedData,
        competences: extractedData.competences || [],
        langues: extractedData.langues || [],
        certifications: extractedData.certifications || [],
        interets: extractedData.interets || [],
        experiences: extractedData.experiences || [],
        formations: extractedData.formations || [],
      };
    } catch (error) {
      this.logger.error('Error extracting CV data:', error);
      throw new Error(`Erreur lors de l'extraction des données du CV: ${error.message}`);
    }
  }

  async processUploadedCV(filePath: string): Promise<ExtractedCV> {
    this.logger.log(`Processing CV from: ${filePath}`);

    // Extract text from PDF
    const pdfText = await this.extractTextFromPDF(filePath);

    if (!pdfText || pdfText.length < 50) {
      throw new Error('Le PDF ne contient pas assez de texte exploitable');
    }

    this.logger.log(`Extracted ${pdfText.length} characters from PDF`);

    // Extract structured data using AI
    const extractedData = await this.extractCVData(pdfText);

    this.logger.log(
      `Extracted: ${extractedData.experiences?.length || 0} experiences, ${extractedData.formations?.length || 0} formations`,
    );

    return extractedData;
  }
}
