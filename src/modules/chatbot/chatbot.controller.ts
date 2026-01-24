import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChatbotService } from './chatbot.service';
import { ChatMessageDto } from './dto';
import { CurrentUser, Public } from '../../common';

@ApiTags('Chatbot')
@ApiBearerAuth()
@Controller('api/chatbot')
export class ChatbotController {
  constructor(private chatbotService: ChatbotService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Envoyer un message au chatbot' })
  async chat(@Body() dto: ChatMessageDto, @CurrentUser('id') userId: number) {
    return this.chatbotService.chat(dto, userId);
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
