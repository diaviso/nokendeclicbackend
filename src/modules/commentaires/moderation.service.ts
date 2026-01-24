import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class ModerationService {
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey'),
    });
  }

  async moderateContent(content: string): Promise<{ isAppropriate: boolean; moderatedContent: string }> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Tu es un modérateur de contenu. Analyse le commentaire suivant et détermine s'il contient des propos inappropriés (insultes, propos haineux, discriminatoires, vulgaires, menaçants, spam, ou tout contenu offensant).

Réponds UNIQUEMENT avec un JSON valide dans ce format exact:
{"appropriate": true} si le contenu est acceptable
{"appropriate": false} si le contenu est inapproprié

Ne réponds rien d'autre que ce JSON.`,
          },
          {
            role: 'user',
            content: content,
          },
        ],
        temperature: 0,
        max_tokens: 50,
      });

      const result = response.choices[0]?.message?.content?.trim() || '{"appropriate": true}';
      
      try {
        const parsed = JSON.parse(result);
        
        if (parsed.appropriate === false) {
          return {
            isAppropriate: false,
            moderatedContent: '⚠️ Ce commentaire a été modéré pour propos inapproprié.',
          };
        }
        
        return {
          isAppropriate: true,
          moderatedContent: content,
        };
      } catch {
        // If JSON parsing fails, assume content is appropriate
        return {
          isAppropriate: true,
          moderatedContent: content,
        };
      }
    } catch (error) {
      console.error('Moderation error:', error);
      // In case of API error, let the content through but log it
      return {
        isAppropriate: true,
        moderatedContent: content,
      };
    }
  }
}
