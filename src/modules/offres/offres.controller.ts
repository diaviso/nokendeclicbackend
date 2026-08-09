import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { OffresService } from './offres.service';
import { StorageService } from '../storage/storage.service';
import { CreateOffreDto, UpdateOffreDto, OffresFilterDto } from './dto';
import { CurrentUser, Public } from '../../common';

@ApiTags('Offres')
@ApiBearerAuth()
@Controller('api/offres')
export class OffresController {
  constructor(
    private offresService: OffresService,
    private storage: StorageService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Créer une offre' })
  async create(@Body() dto: CreateOffreDto, @CurrentUser('id') userId: number) {
    return this.offresService.create(dto, userId);
  }

  @Post('with-document')
  @UseInterceptors(FileInterceptor('document'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Créer une offre avec document' })
  async createWithDocument(
    @Body() dto: CreateOffreDto,
    @UploadedFile() file: any,
    @CurrentUser('id') userId: number,
  ) {
    const offre = await this.offresService.create(dto, userId);
    
    if (file) {
      const stored = await this.storage.upload(file, 'documents');
      await this.offresService.updateDocument(
        offre.id,
        stored.url,
        stored.originalName,
        stored.mimetype,
      );
    }
    
    return this.offresService.findById(offre.id);
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

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Détails d\'une offre' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.offresService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifier une offre' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOffreDto,
    @CurrentUser() user: any,
  ) {
    return this.offresService.update(id, dto, user.id, user.role);
  }

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
      await this.offresService.updateDocument(
        offre.id,
        stored.url,
        stored.originalName,
        stored.mimetype,
      );
    }
    
    return this.offresService.findById(offre.id);
  }

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
