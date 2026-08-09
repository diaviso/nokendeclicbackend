import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TypesOffresService } from './types-offres.service';
import { CreateTypeOffreDto, UpdateTypeOffreDto } from './dto/type-offre.dto';
import { Public, Roles } from '../../common';
import { RolesGuard } from '../../common/guards';

/**
 * Consultation publique des types actifs — le catalogue et les formulaires en
 * ont besoin sans authentification, comme pour les offres elles-mêmes.
 */
@ApiTags('Types d’offres')
@Controller('api/types-offres')
export class TypesOffresController {
  constructor(private typesOffresService: TypesOffresService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Types d’offres actifs, avec leurs champs' })
  async findAll() {
    return this.typesOffresService.findAllPublic();
  }

  @Public()
  @Get('code/:code')
  @ApiOperation({ summary: 'Type d’offre par code' })
  async findByCode(@Param('code') code: string) {
    return this.typesOffresService.findByCode(code.toUpperCase());
  }
}

@ApiTags('Admin - Types d’offres')
@ApiBearerAuth()
@Controller('api/admin/types-offres')
@UseGuards(RolesGuard)
@Roles('ADMIN' as any)
export class AdminTypesOffresController {
  constructor(private typesOffresService: TypesOffresService) {}

  @Get()
  @ApiOperation({ summary: 'Tous les types, actifs ou non' })
  async findAll() {
    return this.typesOffresService.findAllAdmin();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d’un type' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.typesOffresService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un type d’offre' })
  async create(@Body() dto: CreateTypeOffreDto) {
    return this.typesOffresService.create(dto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Modifier un type et ses champs',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTypeOffreDto,
  ) {
    return this.typesOffresService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Supprimer un type — refusé si des offres y sont rattachées',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.typesOffresService.remove(id);
  }
}
