import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseIntPipe,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadService } from './upload.service';
import { StorageService } from '../storage/storage.service';
import { PeutPublier } from '../../common/decorators/peut-publier.decorator';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Image insérée dans le corps d'une annonce.
   *
   * Détachée de l'offre, contrairement aux pièces jointes : au moment où l'on
   * illustre un paragraphe, l'annonce n'existe pas encore en base. Le fichier
   * est déposé, son adresse renvoyée, et c'est le balisage enregistré ensuite
   * qui la référence.
   */
  @PeutPublier()
  @Post('image-contenu')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: "Déposer une image pour le corps d'une annonce" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async deposerImageContenu(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException("Ce fichier n'est pas une image");
    }

    // Plafond propre à l'illustration : une photo de trois mégaoctets dans le
    // corps d'une annonce, c'est une page qui met dix secondes à s'afficher sur
    // une connexion mobile.
    const PLAFOND = 3 * 1024 * 1024;
    if (file.size > PLAFOND) {
      throw new BadRequestException(
        'Image trop lourde : 3 Mo au maximum. Réduisez-la avant de la déposer.',
      );
    }

    const stocke = await this.storage.upload(file, 'annonces');
    return { url: stocke.url };
  }

  @Post('offre/:offreId')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file for an offer' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadOffreFile(
    @Param('offreId', ParseIntPipe) offreId: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    return this.uploadService.addFileToOffre(
      offreId,
      file,
      req.user.id,
      req.user.role,
    );
  }

  @Post('offre/:offreId/multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload multiple files for an offer' })
  @ApiConsumes('multipart/form-data')
  async uploadMultipleOffreFiles(
    @Param('offreId', ParseIntPipe) offreId: number,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any,
  ) {
    const results: any[] = [];
    for (const file of files) {
      const result = await this.uploadService.addFileToOffre(
        offreId,
        file,
        req.user.id,
        req.user.role,
      );
      results.push(result);
    }
    return results;
  }

  @Get('offre/:offreId')
  @ApiOperation({ summary: 'Get all files for an offer' })
  async getOffreFiles(@Param('offreId', ParseIntPipe) offreId: number) {
    return this.uploadService.getOffreFichiers(offreId);
  }

  @Delete(':fichierId')
  @ApiOperation({ summary: 'Delete a file' })
  async deleteFile(
    @Param('fichierId', ParseIntPipe) fichierId: number,
    @Request() req: any,
  ) {
    return this.uploadService.deleteFichier(fichierId, req.user.id, req.user.role);
  }

  @Patch(':fichierId')
  @ApiOperation({ summary: 'Update file name' })
  async updateFileName(
    @Param('fichierId', ParseIntPipe) fichierId: number,
    @Body('nom') nom: string,
    @Request() req: any,
  ) {
    return this.uploadService.updateFichierName(
      fichierId,
      nom,
      req.user.id,
      req.user.role,
    );
  }
}
