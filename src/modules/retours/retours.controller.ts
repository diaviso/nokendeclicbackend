import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RetoursService } from './retours.service';
import { CreateRetourDto, UpdateRetourDto, ReplyRetourDto } from './dto';
import { CurrentUser, Roles } from '../../common';
import { RolesGuard } from '../../common/guards';

@ApiTags('Retours')
@ApiBearerAuth()
@Controller('api/retours')
export class RetoursController {
  constructor(private retoursService: RetoursService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un retour (candidature)' })
  async create(@Body() dto: CreateRetourDto, @CurrentUser('id') userId: number) {
    return this.retoursService.create(dto, userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Liste tous les retours (Admin)' })
  async findAll(@CurrentUser('role') userRole: string) {
    return this.retoursService.findAll(userRole);
  }

  @Get('mes-retours')
  @ApiOperation({ summary: 'Mes retours' })
  async findMyRetours(@CurrentUser('id') userId: number) {
    return this.retoursService.findMyRetours(userId);
  }

  @Get('offre/:offreId')
  @ApiOperation({ summary: 'Retours d\'une offre' })
  async findByOffre(
    @Param('offreId', ParseIntPipe) offreId: number,
    @CurrentUser() user: any,
  ) {
    return this.retoursService.findByOffre(offreId, user.id, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détails d\'un retour' })
  async findById(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.retoursService.findById(id, user.id, user.role);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Modifier un retour' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRetourDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.retoursService.update(id, dto, userId);
  }

  @Put(':id/reply')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Répondre à un retour (Admin)' })
  async reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplyRetourDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.retoursService.reply(id, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un retour' })
  async delete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any) {
    return this.retoursService.delete(id, user.id, user.role);
  }
}
