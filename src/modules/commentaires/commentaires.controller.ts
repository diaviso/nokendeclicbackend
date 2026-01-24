import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentairesService } from './commentaires.service';
import { CreateCommentaireDto, UpdateCommentaireDto } from './dto';
import { CurrentUser } from '../../common';

@ApiTags('Commentaires')
@ApiBearerAuth()
@Controller('api/commentaires')
export class CommentairesController {
  constructor(private commentairesService: CommentairesService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un commentaire' })
  async create(@Body() dto: CreateCommentaireDto, @CurrentUser('id') userId: number) {
    return this.commentairesService.create(dto, userId);
  }

  @Get('offre/:offreId')
  @ApiOperation({ summary: 'Commentaires d\'une offre' })
  async findByOffre(@Param('offreId', ParseIntPipe) offreId: number) {
    return this.commentairesService.findByOffre(offreId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détails d\'un commentaire' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.commentairesService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifier un commentaire' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCommentaireDto,
    @CurrentUser() user: any,
  ) {
    return this.commentairesService.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un commentaire' })
  async delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.commentairesService.delete(id, user.id, user.role);
  }
}
