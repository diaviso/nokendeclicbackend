import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotToolsService } from './chatbot-tools.service';

@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotToolsService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
