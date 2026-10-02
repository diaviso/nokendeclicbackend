import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, PeutPublier } from '../../common';
import {
  DeposerMediaDto,
  ListeMediasDto,
  ModifierMediaDto,
} from './dto/media.dto';
import { MediasService, type Demandeur } from './medias.service';

/**
 * Médiathèque des couvertures. Ouverte à ceux qui publient : l'administration
 * et les partenaires — chacun dans son périmètre, voir `MediasService`.
 */
@ApiTags('Médiathèque')
@ApiBearerAuth()
@PeutPublier()
@Controller('api/medias')
export class MediasController {
  constructor(private readonly medias: MediasService) {}

  @Get()
  @ApiOperation({ summary: 'Images visibles du demandeur' })
  lister(@CurrentUser() user: Demandeur, @Query() filtres: ListeMediasDto) {
    return this.medias.lister(user, filtres);
  }

  @Get('bilan')
  @ApiOperation({ summary: 'Nombre et poids des images, dont non utilisées' })
  bilan(@CurrentUser() user: Demandeur) {
    return this.medias.bilan(user);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Ajouter une image (réutilise l’existante si le fichier est déjà connu)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        nom: { type: 'string' },
        alt: { type: 'string' },
      },
    },
  })
  deposer(
    @CurrentUser() user: Demandeur,
    @UploadedFile() fichier: Express.Multer.File,
    @Body() dto: DeposerMediaDto,
  ) {
    return this.medias.deposer(fichier, user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renommer, décrire ou partager une image' })
  modifier(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: Demandeur,
    @Body() dto: ModifierMediaDto,
  ) {
    return this.medias.modifier(id, user, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une image qu’aucune offre n’utilise' })
  supprimer(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: Demandeur,
  ) {
    return this.medias.supprimer(id, user);
  }
}
