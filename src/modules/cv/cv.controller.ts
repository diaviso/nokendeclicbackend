import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CVService } from './cv.service';
import { CVExtractorService } from './cv-extractor.service';
import { CVCorrectorService } from './cv-corrector.service';
import { CreateCVDto, UpdateCVDto } from './dto';
import { CurrentUser, Public } from '../../common';

@ApiTags('CV')
@ApiBearerAuth()
@Controller('api/cv')
export class CVController {
  constructor(
    private cvService: CVService,
    private cvExtractorService: CVExtractorService,
    private cvCorrectorService: CVCorrectorService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtenir mon CV' })
  async getMyCV(@CurrentUser('id') userId: number) {
    return this.cvService.findByUserId(userId);
  }

  @Post('me')
  @ApiOperation({ summary: 'Créer ou mettre à jour mon CV' })
  async saveMyCV(@CurrentUser('id') userId: number, @Body() dto: CreateCVDto) {
    return this.cvService.update(userId, dto);
  }

  @Post('correct')
  @ApiOperation({ summary: 'Corriger et améliorer le contenu du CV avec l\'IA' })
  async correctCV(@Body() dto: Record<string, any>) {
    const correctedData = await this.cvCorrectorService.correctCV(dto);
    return {
      success: true,
      data: correctedData,
      corrections: correctedData.corrections || [],
    };
  }

  @Delete('me')
  @ApiOperation({ summary: 'Supprimer mon CV' })
  async deleteMyCV(@CurrentUser('id') userId: number) {
    return this.cvService.delete(userId);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Liste des CV publics' })
  async getPublicCVs() {
    return this.cvService.findAllPublic();
  }

  @Public()
  @Get('user/:userId')
  @ApiOperation({ summary: 'Obtenir le CV public d\'un utilisateur' })
  async getPublicCV(@Param('userId', ParseIntPipe) userId: number) {
    return this.cvService.findPublicById(userId);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Uploader un CV PDF et extraire automatiquement les informations' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/cv',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `cv-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(new BadRequestException('Seuls les fichiers PDF sont acceptés'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadAndExtractCV(
    @CurrentUser('id') userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    try {
      // Extract CV data from PDF using AI
      const extractedData = await this.cvExtractorService.processUploadedCV(file.path);

      return {
        success: true,
        message: 'CV analysé avec succès',
        extractedData,
        filePath: file.path,
      };
    } catch (error) {
      throw new BadRequestException(`Erreur lors de l'analyse du CV: ${error.message}`);
    }
  }

  @Post('upload-and-save')
  @ApiOperation({ summary: 'Uploader un CV PDF, extraire et sauvegarder automatiquement' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/cv',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `cv-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(new BadRequestException('Seuls les fichiers PDF sont acceptés'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadExtractAndSaveCV(
    @CurrentUser('id') userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    try {
      // Extract CV data from PDF using AI
      const extractedData = await this.cvExtractorService.processUploadedCV(file.path);

      // Save the extracted data to the database
      const savedCV = await this.cvService.update(userId, extractedData as any);

      return {
        success: true,
        message: 'CV analysé et sauvegardé avec succès',
        cv: savedCV,
      };
    } catch (error) {
      throw new BadRequestException(`Erreur lors de l'analyse du CV: ${error.message}`);
    }
  }
}
