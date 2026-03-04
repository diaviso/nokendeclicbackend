import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeedbackService } from './feedback.service';
import { CurrentUser, Roles } from '../../common';
import { RolesGuard } from '../../common/guards';

// ==================== USER ENDPOINTS ====================

@ApiTags('Feedback')
@ApiBearerAuth()
@Controller('api/feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouveau feedback' })
  async create(
    @CurrentUser('id') userId: number,
    @Body() body: {
      titre: string;
      description: string;
      categorie: 'BUG' | 'AMELIORATION' | 'QUESTION' | 'AUTRE';
      pageUrl?: string;
      capture?: string;
    },
  ) {
    return this.feedbackService.create(userId, body);
  }

  @Get('mes-feedbacks')
  @ApiOperation({ summary: 'Obtenir mes feedbacks' })
  async getMyFeedbacks(
    @CurrentUser('id') userId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.feedbackService.getMyFeedbacks(
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un feedback par ID' })
  async getById(
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.feedbackService.getById(userId, id, role === 'ADMIN');
  }

  @Post(':id/reponses')
  @ApiOperation({ summary: 'Ajouter une réponse à un feedback' })
  async addReponse(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) feedbackId: number,
    @Body('contenu') contenu: string,
  ) {
    return this.feedbackService.addReponse(userId, feedbackId, contenu);
  }
}

// ==================== ADMIN ENDPOINTS ====================

@ApiTags('Admin - Feedback')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN' as any)
@Controller('api/admin/feedback')
export class AdminFeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Get()
  @ApiOperation({ summary: 'Obtenir tous les feedbacks (admin)' })
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('statut') statut?: string,
    @Query('categorie') categorie?: string,
    @Query('search') search?: string,
  ) {
    return this.feedbackService.getAllFeedbacks(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      statut,
      categorie,
      search,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un feedback par ID (admin)' })
  async getById(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.feedbackService.getById(userId, id, true);
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Modifier le statut d\'un feedback' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('statut') statut: string,
  ) {
    return this.feedbackService.updateStatus(id, statut);
  }

  @Post(':id/priority')
  @ApiOperation({ summary: 'Modifier la priorité d\'un feedback' })
  async updatePriority(
    @Param('id', ParseIntPipe) id: number,
    @Body('priorite') priorite: string,
  ) {
    return this.feedbackService.updatePriority(id, priorite);
  }

  @Post(':id/reponses')
  @ApiOperation({ summary: 'Ajouter une réponse admin à un feedback' })
  async addReponse(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) feedbackId: number,
    @Body('contenu') contenu: string,
  ) {
    return this.feedbackService.addReponse(userId, feedbackId, contenu);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un feedback' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.feedbackService.deleteFeedback(id);
  }
}
