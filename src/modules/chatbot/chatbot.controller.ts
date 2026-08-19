import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Logger,
  Param,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChatbotService, type EvenementFlux } from './chatbot.service';
import { ChatMessageDto } from './dto';
import { CurrentUser, Public } from '../../common';

@ApiTags('Chatbot')
@ApiBearerAuth()
@Controller('api/chatbot')
export class ChatbotController {
  private readonly journal = new Logger(ChatbotController.name);

  constructor(private chatbotService: ChatbotService) {}

  @Post('chat')
  // Un seul message peut déclencher plusieurs allers-retours OpenAI (boucle de
  // tool-calling) : plafond dédié pour borner le coût.
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Envoyer un message au chatbot' })
  async chat(@Body() dto: ChatMessageDto, @CurrentUser('id') userId: number) {
    return this.chatbotService.chat(dto, userId);
  }

  /**
   * Même échange, diffusé au fil de l'eau.
   *
   * En POST et non en `@Sse()` : `EventSource` ne sait pas poser d'en-tête
   * `Authorization`, et la requête porte un message qui n'a pas sa place dans
   * une adresse. Le client lit donc le corps de la réponse par fragments.
   */
  @Post('chat/flux')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Envoyer un message et recevoir la réponse en flux' })
  async chatEnFlux(
    @Body() dto: ChatMessageDto,
    @CurrentUser('id') userId: number,
    @Res() reponse: Response,
  ) {
    reponse.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    reponse.setHeader('Cache-Control', 'no-cache, no-transform');
    reponse.setHeader('Connection', 'keep-alive');
    // Sans cet en-tête, un proxy qui met en tampon retiendrait la réponse
    // jusqu'à sa fin — et le flux n'aurait plus aucun intérêt.
    reponse.setHeader('X-Accel-Buffering', 'no');
    reponse.flushHeaders?.();

    const envoyer = (evenement: EvenementFlux) => {
      reponse.write(`data: ${JSON.stringify(evenement)}

`);
    };

    try {
      for await (const evenement of this.chatbotService.chatEnFlux(dto, userId)) {
        envoyer(evenement);
      }
    } catch (erreur) {
      // L'en-tête est déjà parti : impossible de renvoyer un code d'erreur, on
      // signale la panne dans le flux lui-même.
      this.journal.error(
        `Flux du chatbot interrompu : ${erreur instanceof Error ? erreur.message : erreur}`,
      );
      envoyer({
        type: 'erreur',
        message: "La réponse s'est interrompue. Réessayez.",
      });
    } finally {
      reponse.end();
    }
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Liste des conversations' })
  async getConversations(@CurrentUser('id') userId: number) {
    return this.chatbotService.getConversations(userId);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Détails d\'une conversation' })
  async getConversation(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: number,
  ) {
    return this.chatbotService.getConversation(conversationId, userId);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Supprimer une conversation' })
  async deleteConversation(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: number,
  ) {
    return this.chatbotService.deleteConversation(conversationId, userId);
  }

  @Public()
  @Get('suggestions')
  @ApiOperation({ summary: 'Suggestions de questions' })
  getSuggestions() {
    return this.chatbotService.getSuggestions();
  }
}
