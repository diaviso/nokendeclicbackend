import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfilsService } from './profils.service';
import { CVService } from '../cv/cv.service';
import { RechercheProfilsDto } from './dto/recherche-profils.dto';
import { Roles } from '../../common';
import { RolesGuard } from '../../common/guards';

/**
 * Recherche de profils, réservée aux partenaires et à l'administration.
 *
 * Aucune route publique ici, et aucune coordonnée dans les réponses : un membre
 * a accepté d'être repéré par les recruteurs de la plateforme, pas d'être
 * listé sur l'internet ouvert ni d'être appelé directement. La prise de contact
 * passe par la messagerie interne.
 */
@ApiTags('Profils')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN' as any, 'PARTENAIRE' as any)
@Controller('api/profils')
export class ProfilsController {
  constructor(
    private profilsService: ProfilsService,
    private cvService: CVService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Rechercher des profils, classés par correspondance' })
  async rechercher(@Query() filtres: RechercheProfilsDto) {
    return this.profilsService.rechercher(filtres);
  }

  @Get('competences')
  @ApiOperation({ summary: 'Compétences présentes dans le vivier' })
  async competences() {
    return this.profilsService.competencesDisponibles();
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Profil détaillé d’un candidat' })
  async detail(@Param('userId', ParseIntPipe) userId: number) {
    return this.cvService.findPublicById(userId);
  }
}
