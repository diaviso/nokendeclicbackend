import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LikesService } from './likes.service';
import { CurrentUser, Public } from '../../common';

@ApiTags('Likes')
@ApiBearerAuth()
@Controller('api/likes')
export class LikesController {
  constructor(private likesService: LikesService) {}

  @Post(':offreId')
  @ApiOperation({ summary: 'Aimer ou retirer son « j’aime » sur une offre' })
  async toggle(
    @Param('offreId', ParseIntPipe) offreId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.likesService.toggle(userId, offreId);
  }

  // Public : le total s'affiche sur la page d'offre, rendue côté serveur pour
  // les visiteurs non connectés. `liked` vaut alors simplement false.
  @Public()
  @Get(':offreId')
  @ApiOperation({ summary: 'Total des « j’aime » d’une offre' })
  async statut(@Param('offreId', ParseIntPipe) offreId: number) {
    return this.likesService.statut(undefined, offreId);
  }

  @Get(':offreId/moi')
  @ApiOperation({ summary: 'Total, et si l’utilisateur connecté a aimé' })
  async statutPersonnel(
    @Param('offreId', ParseIntPipe) offreId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.likesService.statut(userId, offreId);
  }

  @Post('mes-likes')
  @ApiOperation({
    summary: 'Parmi ces offres, celles aimées par l’utilisateur connecté',
  })
  async mesLikes(
    @Body('offreIds') offreIds: number[],
    @CurrentUser('id') userId: number,
  ) {
    return this.likesService.mesLikes(userId, offreIds ?? []);
  }
}
