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
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import type { Response } from 'express';
import { join } from 'path';
import { OffresService } from './offres.service';
import { CreateOffreDto, UpdateOffreDto, OffresFilterDto } from './dto';
import { CurrentUser, Public } from '../../common';

@ApiTags('Offres')
@ApiBearerAuth()
@Controller('api/offres')
export class OffresController {
  constructor(private offresService: OffresService) {}

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
      await this.offresService.updateDocument(
        offre.id,
        `/api/offres/documents/${file.filename}`,
        file.originalname,
        file.mimetype,
      );
    }
    
    return this.offresService.findById(offre.id);
  }

  @Get()
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
      await this.offresService.updateDocument(
        offre.id,
        `/api/offres/documents/${file.filename}`,
        file.originalname,
        file.mimetype,
      );
    }
    
    return this.offresService.findById(offre.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une offre' })
  async delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.offresService.delete(id, user.id, user.role);
  }

  @Public()
  @Get('documents/:filename')
  @ApiOperation({ summary: 'Télécharger un document' })
  async getDocument(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(process.cwd(), 'uploads', 'documents', filename);
    return res.sendFile(filePath);
  }
}
