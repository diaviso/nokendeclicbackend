import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { OffresService } from './offres.service';
import { StorageService } from '../storage/storage.service';
import {
  CreateOffreDto,
  UpdateOffreDto,
  OffresFilterDto,
  ModererOffreDto,
} from './dto';
import { CurrentUser, PeutPublier, Public, Roles } from '../../common';
import { RolesGuard } from '../../common/guards';

@ApiTags('Offres')
@ApiBearerAuth()
@Controller('api/offres')
export class OffresController {
  constructor(
    private offresService: OffresService,
    private storage: StorageService,
  ) {}

  @PeutPublier()
  @Post()
  @ApiOperation({ summary: 'Créer une offre' })
  async create(@Body() dto: CreateOffreDto, @CurrentUser() user: any) {
    return this.offresService.create(dto, user.id, user.role);
  }

  @PeutPublier()
  @Post('with-document')
  @UseInterceptors(FileInterceptor('document'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Créer une offre avec document' })
  async createWithDocument(
    @Body() dto: CreateOffreDto,
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    const offre = await this.offresService.create(dto, user.id, user.role);

    if (file) {
      const stored = await this.storage.upload(file, 'documents');
      await this.offresService.updateMedia(offre.id, {
        documentUrl: stored.url,
        documentName: stored.originalName,
        documentType: stored.mimetype,
      });
    }

    // Relecture, et non `findById` : l'offre d'un partenaire vient d'être mise
    // en attente, et la route publique ne la renverrait pas.
    return this.offresService.findPourEdition(offre.id, user.id, user.role);
  }

  /**
   * File de modération. Réservée à l'administration : c'est elle qui tranche,
   * un partenaire n'a aucune raison de voir les dépôts des autres.
   */
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @Get('moderation/en-attente')
  @ApiOperation({ summary: 'Offres en attente de validation' })
  async findEnAttente() {
    return this.offresService.findEnAttente();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @Post(':id/moderation')
  @ApiOperation({ summary: 'Valider ou refuser une offre' })
  async moderer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModererOffreDto,
    @CurrentUser('id') moderateurId: number,
  ) {
    return this.offresService.moderer(
      id,
      { statut: dto.statut, motif: dto.motif },
      moderateurId,
    );
  }

  // Catalogue public : c'est la condition pour que les pages d'offres puissent
  // être rendues côté serveur et donc indexées. La projection ne contient que
  // des données destinées à la publication (aucun email, aucun contact).
  @Get()
  @Public()
  @ApiOperation({ summary: 'Liste des offres avec filtres et pagination' })
  async findAll(@Query() filters: OffresFilterDto) {
    return this.offresService.findAll(filters);
  }

  @Get('types')
  @Public()
  @ApiOperation({ summary: 'Liste des types disponibles' })
  async getTypes() {
    return this.offresService.getTypes();
  }

  @Get('mes-offres')
  @ApiOperation({ summary: 'Mes offres' })
  async findMyOffres(@CurrentUser('id') userId: number) {
    return this.offresService.findByAuteur(userId);
  }

  /**
   * Offre telle que son auteur doit la voir pour la modifier — y compris un
   * dépôt en attente ou refusé, que la route publique masque. Elle exige une
   * session et ne compte pas de consultation.
   */
  @Get(':id/edition')
  @ApiOperation({ summary: 'Détails d\'une offre pour son auteur' })
  async findPourEdition(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.offresService.findPourEdition(id, user.id, user.role);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Détails d\'une offre' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.offresService.findById(id);
  }

  @PeutPublier()
  @Put(':id')
  @ApiOperation({ summary: 'Modifier une offre' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOffreDto,
    @CurrentUser() user: any,
  ) {
    return this.offresService.update(id, dto, user.id, user.role);
  }

  @PeutPublier()
  @Put(':id/with-document')
  @UseInterceptors(FileInterceptor('document'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Modifier une offre avec document' })
  async updateWithDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOffreDto,
    @UploadedFile() file: any,
    @CurrentUser() user: any,
  ) {
    const offre = await this.offresService.update(id, dto, user.id, user.role);
    
    if (file) {
      const stored = await this.storage.upload(file, 'documents');
      await this.offresService.updateMedia(offre.id, {
        documentUrl: stored.url,
        documentName: stored.originalName,
        documentType: stored.mimetype,
      });
    }
    
    return this.offresService.findById(offre.id);
  }

  @PeutPublier()
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Envoyer la photo de couverture' })
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException(
        'La couverture doit être une image (JPEG, PNG ou WebP)',
      );
    }

    const stored = await this.storage.upload(file, 'couvertures');
    return this.offresService.updateMedia(
      id,
      { imageUrl: stored.url },
      { userId: user.id, userRole: user.role },
    );
  }

  @PeutPublier()
  @Delete(':id/image')
  @ApiOperation({ summary: 'Retirer la photo de couverture' })
  async removeImage(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.offresService.updateMedia(
      id,
      { imageUrl: null },
      { userId: user.id, userRole: user.role },
    );
  }

  @PeutPublier()
  @Post(':id/document')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Envoyer le document joint' })
  async uploadDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Le document joint doit être un PDF');
    }

    const stored = await this.storage.upload(file, 'documents');
    return this.offresService.updateMedia(
      id,
      {
        documentUrl: stored.url,
        documentName: stored.originalName,
        documentType: stored.mimetype,
      },
      { userId: user.id, userRole: user.role },
    );
  }

  @PeutPublier()
  @Delete(':id/document')
  @ApiOperation({ summary: 'Retirer le document joint' })
  async removeDocument(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.offresService.updateMedia(
      id,
      { documentUrl: null, documentName: null, documentType: null },
      { userId: user.id, userRole: user.role },
    );
  }

  @PeutPublier()
  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une offre' })
  async delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.offresService.delete(id, user.id, user.role);
  }

  // GET /api/offres/documents/:filename a été supprimée.
  //
  // Elle servait les documents depuis le disque local, désormais remplacé par
  // Cloudflare R2 : `documentUrl` porte directement l'URL publique de l'objet.
  // Cette route était par ailleurs vulnérable à une traversée de chemin — le
  // paramètre `filename` était concaténé sans assainissement dans un `join()`,
  // sur une route annotée @Public().
}
