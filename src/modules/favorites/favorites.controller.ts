import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CurrentUser } from '../../common';

@ApiTags('Favorites')
@ApiBearerAuth()
@Controller('api/favorites')
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Post(':offreId')
  @ApiOperation({ summary: 'Ajouter une offre aux favoris' })
  async add(
    @Param('offreId', ParseIntPipe) offreId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.favoritesService.add(userId, offreId);
  }

  @Delete(':offreId')
  @ApiOperation({ summary: 'Retirer une offre des favoris' })
  async remove(
    @Param('offreId', ParseIntPipe) offreId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.favoritesService.remove(userId, offreId);
  }

  @Get()
  @ApiOperation({ summary: 'Liste de mes favoris' })
  async findMyFavorites(@CurrentUser('id') userId: number) {
    return this.favoritesService.findByUser(userId);
  }

  @Get(':offreId/check')
  @ApiOperation({ summary: 'Vérifier si une offre est en favori' })
  async isFavorite(
    @Param('offreId', ParseIntPipe) offreId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.favoritesService.isFavorite(userId, offreId);
  }
}
