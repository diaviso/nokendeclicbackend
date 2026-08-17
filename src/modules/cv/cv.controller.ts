import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { CVService } from './cv.service';
import { CVExtractorService } from './cv-extractor.service';
import { CVCorrectorService } from './cv-corrector.service';
import { CorrectCVDto, CreateCVDto, UpdateCVDto } from './dto';
import { CurrentUser, Roles } from '../../common';
import { RolesGuard } from '../../common/guards';

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
  // Route coûteuse (appel OpenAI) : plafond dédié, très en dessous du throttle
  // global de 100 req/min, pour borner le coût par utilisateur.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Corriger et améliorer le contenu du CV avec l\'IA' })
  async correctCV(@Body() dto: CorrectCVDto) {
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

  /**
   * Ces deux routes étaient annotées `@Public()` : sans le moindre compte, on
   * obtenait la liste complète des CV rendus visibles — téléphone et adresse
   * compris. Rendre son CV « visible pour les recruteurs partenaires », ce que
   * dit l'interface, n'a jamais voulu dire le publier sur l'internet ouvert.
   *
   * L'accès est désormais réservé aux partenaires et aux administrateurs, et la
   * projection ne comporte plus de coordonnées directes : un partenaire prend
   * contact par la messagerie interne, et le candidat décide de répondre.
   */
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any, 'PARTENAIRE' as any)
  @Get('public')
  @ApiOperation({ summary: 'Liste des CV visibles par les recruteurs' })
  async getPublicCVs() {
    return this.cvService.findAllPublic();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any, 'PARTENAIRE' as any)
  @Get('user/:userId')
  @ApiOperation({ summary: 'Obtenir le CV visible d\'un utilisateur' })
  async getPublicCV(@Param('userId', ParseIntPipe) userId: number) {
    return this.cvService.findPublicById(userId);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Uploader un CV PDF et extraire automatiquement les informations' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      // Le PDF n'est lu que pour en extraire les données : il n'a pas besoin
      // d'être persisté. Le garder en mémoire évite d'écrire sur un disque
      // éphémère, et supprime le nettoyage de fichiers temporaires.
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        // Un CV photographié au téléphone arrive en JPEG : n'accepter que le
        // PDF fermait la porte au cas le plus fréquent du public visé.
        if (!CVExtractorService.TYPES_ACCEPTES.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Formats acceptés : PDF, JPEG, PNG, WebP ou HEIC.',
            ),
            false,
          );
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
      const extractedData = await this.cvExtractorService.processUploadedCV(file);

      return {
        success: true,
        message: 'CV analysé avec succès',
        extractedData,
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
      // Le PDF n'est lu que pour en extraire les données : il n'a pas besoin
      // d'être persisté. Le garder en mémoire évite d'écrire sur un disque
      // éphémère, et supprime le nettoyage de fichiers temporaires.
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        // Un CV photographié au téléphone arrive en JPEG : n'accepter que le
        // PDF fermait la porte au cas le plus fréquent du public visé.
        if (!CVExtractorService.TYPES_ACCEPTES.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Formats acceptés : PDF, JPEG, PNG, WebP ou HEIC.',
            ),
            false,
          );
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
      const extractedData = await this.cvExtractorService.processUploadedCV(file);

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
