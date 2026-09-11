import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common';
import { RolesGuard } from '../../common/guards';
import { AgentsIaService } from './agents-ia.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN' as any)
@Controller('api/admin/agents-ia')
export class AgentsIaController {
  constructor(private readonly agentsIa: AgentsIaService) {}

  @Get()
  @ApiOperation({
    summary: "Usage des agents IA : qui s'en sert, pour demander quoi",
  })
  @ApiQuery({
    name: 'jours',
    required: false,
    type: Number,
    description: 'Taille de la période en jours ; 0 pour tout l’historique',
  })
  statistiques(@Query('jours') jours?: string) {
    const valeur = jours === undefined || jours === '' ? 30 : Number(jours);
    if (!Number.isInteger(valeur) || valeur < 0 || valeur > 3650) {
      throw new BadRequestException(
        'La période doit être un nombre entier de jours, entre 0 et 3650.',
      );
    }
    return this.agentsIa.statistiques(valeur);
  }
}
