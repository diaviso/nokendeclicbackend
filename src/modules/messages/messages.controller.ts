import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto, ReplyMessageDto } from './dto';
import { CurrentUser, Roles } from '../../common';
import { RolesGuard } from '../../common/guards';

@ApiTags('Messages')
@ApiBearerAuth()
@Controller('api/messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Envoyer un message' })
  async create(@Body() dto: CreateMessageDto, @CurrentUser('id') userId: number) {
    return this.messagesService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des messages' })
  async findAll(@CurrentUser() user: any) {
    return this.messagesService.findAll(user.id, user.role);
  }

  @Get('unread-count')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Nombre de messages non lus (Admin)' })
  async getUnreadCount() {
    return { count: await this.messagesService.getUnreadCount() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détails d\'un message' })
  async findById(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.messagesService.findById(id, user.id, user.role);
  }

  @Put(':id/mark-read')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Marquer comme lu (Admin)' })
  async markAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.messagesService.markAsRead(id);
  }

  @Put(':id/reply')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Répondre à un message (Admin)' })
  async reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyMessageDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.messagesService.reply(id, dto, userId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Supprimer un message (Admin)' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.messagesService.delete(id);
  }
}
