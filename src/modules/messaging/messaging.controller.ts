import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagingService } from './messaging.service';
import { CurrentUser } from '../../common';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('messaging')
export class MessagingController {
  constructor(private messagingService: MessagingService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Get all conversations for current user' })
  async getConversations(@CurrentUser('id') userId: number) {
    return this.messagingService.getConversations(userId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  async getMessages(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) conversationId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messagingService.getMessages(
      userId,
      conversationId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Post('conversations/start/:userId')
  @ApiOperation({ summary: 'Start or get existing conversation with a user' })
  async startConversation(
    @CurrentUser('id') currentUserId: number,
    @Param('userId', ParseIntPipe) otherUserId: number,
  ) {
    return this.messagingService.getOrCreateConversation(currentUserId, otherUserId);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  async sendMessage(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) conversationId: number,
    @Body('content') content: string,
  ) {
    return this.messagingService.sendMessage(userId, conversationId, content);
  }

  @Delete('conversations/:id')
  @ApiOperation({ summary: 'Delete a conversation' })
  async deleteConversation(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) conversationId: number,
  ) {
    return this.messagingService.deleteConversation(userId, conversationId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get total unread messages count' })
  async getUnreadCount(@CurrentUser('id') userId: number) {
    return this.messagingService.getUnreadCount(userId);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Get users that can be contacted' })
  async getContactableUsers(@CurrentUser('id') userId: number) {
    return this.messagingService.getContactableUsers(userId);
  }

  @Post('messages/:id/update')
  @ApiOperation({ summary: 'Update a message' })
  async updateMessage(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) messageId: number,
    @Body('content') content: string,
  ) {
    return this.messagingService.updateMessage(userId, messageId, content);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Delete a message' })
  async deleteMessage(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) messageId: number,
  ) {
    return this.messagingService.deleteMessage(userId, messageId);
  }
}
