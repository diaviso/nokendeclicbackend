import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartenaireService } from './partenaire.service';
import { StorageService } from '../storage/storage.service';
import {
  EntreprisePartenaireDto,
  NoteFavoriDto,
  VitrineDto,
} from './dto/partenaire.dto';
import { CurrentUser, Public, Roles } from '../../common';
import { RolesGuard } from '../../common/guards';

/**
 * Espace du partenaire : fiche de sa structure et candidats mis de côté.
 *
 * Réservé aux comptes partenaires et à l'administration, à l'exception de la
 * vitrine, publique par nature puisqu'elle alimente la page d'accueil.
 */
@ApiTags('Partenaire')
@ApiBearerAuth()
@Controller('api/partenaire')
export class PartenaireController {
  constructor(
    private partenaireService: PartenaireService,
    private storage: StorageService,
  ) {}

  /** Vitrine publique — déclarée en premier, avant toute garde de rôle. */
  @Public()
  @Get('vitrine')
  @ApiOperation({ summary: 'Structures partenaires mises en avant' })
  async vitrine() {
    return this.partenaireService.vitrine();
  }

  /* ------------------------------------------- Vitrine (administration) */

  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @Get('administration/entreprises')
  @ApiOperation({ summary: 'Toutes les structures partenaires' })
  async listerPourAdministration() {
    return this.partenaireService.listerPourAdministration();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @Patch('administration/entreprises/:id/vitrine')
  @ApiOperation({ summary: "Mettre une structure en vitrine, ou l'en retirer" })
  async reglerVitrine(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VitrineDto,
  ) {
    return this.partenaireService.reglerVitrine(id, dto);
  }

  /* ------------------------------------------------------------ Entreprise */

  @UseGuards(RolesGuard)
  @Roles('PARTENAIRE' as any, 'ADMIN' as any)
  @Get('entreprise')
  @ApiOperation({ summary: 'Fiche de ma structure' })
  async monEntreprise(@CurrentUser('id') userId: number) {
    return this.partenaireService.monEntreprise(userId);
  }

  @UseGuards(RolesGuard)
  @Roles('PARTENAIRE' as any, 'ADMIN' as any)
  @Put('entreprise')
  @ApiOperation({ summary: 'Créer ou mettre à jour la fiche de ma structure' })
  async enregistrerEntreprise(
    @CurrentUser('id') userId: number,
    @Body() dto: EntreprisePartenaireDto,
  ) {
    return this.partenaireService.enregistrerEntreprise(userId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('PARTENAIRE' as any, 'ADMIN' as any)
  @Post('entreprise/logo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Envoyer le logo de la structure' })
  async envoyerLogo(
    @CurrentUser('id') userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Le logo doit être une image');
    }

    const stocke = await this.storage.upload(file, 'logos');
    return this.partenaireService.definirLogo(userId, stocke.url);
  }

  @UseGuards(RolesGuard)
  @Roles('PARTENAIRE' as any, 'ADMIN' as any)
  @Delete('entreprise/logo')
  @ApiOperation({ summary: 'Retirer le logo' })
  async retirerLogo(@CurrentUser('id') userId: number) {
    return this.partenaireService.definirLogo(userId, null);
  }

  /* --------------------------------------------------------------- Favoris */

  @UseGuards(RolesGuard)
  @Roles('PARTENAIRE' as any, 'ADMIN' as any)
  @Get('favoris')
  @ApiOperation({ summary: 'Mes candidats mis de côté' })
  async mesFavoris(@CurrentUser('id') userId: number) {
    return this.partenaireService.mesFavoris(userId);
  }

  @UseGuards(RolesGuard)
  @Roles('PARTENAIRE' as any, 'ADMIN' as any)
  @Get('favoris/identifiants')
  @ApiOperation({ summary: 'Identifiants des candidats déjà en favori' })
  async identifiants(@CurrentUser('id') userId: number) {
    return this.partenaireService.identifiantsFavoris(userId);
  }

  @UseGuards(RolesGuard)
  @Roles('PARTENAIRE' as any, 'ADMIN' as any)
  @Post('favoris/:candidatId')
  @ApiOperation({ summary: 'Mettre un candidat de côté' })
  async ajouter(
    @CurrentUser('id') userId: number,
    @Param('candidatId', ParseIntPipe) candidatId: number,
    @Body() dto: NoteFavoriDto,
  ) {
    return this.partenaireService.ajouterFavori(userId, candidatId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('PARTENAIRE' as any, 'ADMIN' as any)
  @Delete('favoris/:candidatId')
  @ApiOperation({ summary: 'Retirer un candidat de mes favoris' })
  async retirer(
    @CurrentUser('id') userId: number,
    @Param('candidatId', ParseIntPipe) candidatId: number,
  ) {
    return this.partenaireService.retirerFavori(userId, candidatId);
  }
}
