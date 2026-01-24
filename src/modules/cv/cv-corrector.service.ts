import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export interface CVData {
  titreProfessionnel?: string;
  resume?: string;
  competences?: string[];
  langues?: string[];
  certifications?: string[];
  interets?: string[];
  experiences?: {
    poste: string;
    entreprise: string;
    ville?: string;
    description?: string;
  }[];
  formations?: {
    diplome: string;
    etablissement: string;
    ville?: string;
    description?: string;
  }[];
}

export interface CorrectedCVData extends CVData {
  corrections?: {
    field: string;
    original: string;
    corrected: string;
    reason: string;
  }[];
}

@Injectable()
export class CVCorrectorService {
  private readonly logger = new Logger(CVCorrectorService.name);
  private chatModel: ChatOpenAI;

  private readonly systemPrompt = `Tu es un expert en rédaction de CV professionnels en français.
Ton rôle est d'analyser et corriger un CV pour le rendre impeccable et professionnel.

Tu dois:
1. Corriger toutes les fautes d'orthographe et de grammaire
2. Améliorer le style pour qu'il soit professionnel et adapté à un CV
3. Reformuler les phrases maladroites
4. Utiliser un vocabulaire professionnel et percutant
5. Garder le sens original tout en améliorant la qualité

IMPORTANT:
- Retourne UNIQUEMENT du JSON valide
- Conserve la structure exacte des données d'entrée
- Pour chaque modification, ajoute une entrée dans le tableau "corrections"
- Si aucune correction n'est nécessaire pour un champ, garde la valeur originale
- Les tableaux (competences, langues, etc.) doivent rester des tableaux
- Ne modifie PAS les noms d'entreprises, d'établissements ou de villes
- Les dates ne doivent pas être modifiées

Format de sortie attendu:
{
  "titreProfessionnel": "...",
  "resume": "...",
  "competences": [...],
  "langues": [...],
  "certifications": [...],
  "interets": [...],
  "experiences": [...],
  "formations": [...],
  "corrections": [
    {
      "field": "nom du champ",
      "original": "texte original",
      "corrected": "texte corrigé",
      "reason": "raison de la correction"
    }
  ]
}`;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY is not configured');
    }

    this.chatModel = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 4000,
    });
  }

  async correctCV(cvData: CVData): Promise<CorrectedCVData> {
    try {
      this.logger.log('Starting CV correction...');

      const messages = [
        new SystemMessage(this.systemPrompt),
        new HumanMessage(
          `Voici les données du CV à corriger et améliorer:\n\n${JSON.stringify(cvData, null, 2)}`,
        ),
      ];

      const response = await this.chatModel.invoke(messages);
      const content = response.content as string;

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Impossible de parser la réponse JSON');
      }

      const correctedData = JSON.parse(jsonMatch[0]) as CorrectedCVData;

      this.logger.log(
        `CV corrected with ${correctedData.corrections?.length || 0} corrections`,
      );

      return correctedData;
    } catch (error) {
      this.logger.error('Error correcting CV:', error);
      // En cas d'erreur, retourner les données originales sans corrections
      return { ...cvData, corrections: [] };
    }
  }
}
