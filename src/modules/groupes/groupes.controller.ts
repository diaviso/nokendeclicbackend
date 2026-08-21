import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common';
import { GroupesService } from './groupes.service';
import {
  CreerGroupeDto,
  InviterDto,
  MessageGroupeDto,
  ModifierGroupeDto,
  RoleMembreDto,
} from './dto';

@ApiTags('Groupes de discussion')
@ApiBearerAuth()
@Controller('groupes')
export class GroupesController {
  constructor(private readonly groupes: GroupesService) {}

  @Get()
  @ApiOperation({ summary: 'Mes groupes de discussion' })
  mesGroupes(@CurrentUser('id') userId: number) {
    return this.groupes.mesGroupes(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un groupe' })
  creer(@CurrentUser('id') userId: number, @Body() dto: CreerGroupeDto) {
    return this.groupes.creer(userId, dto);
  }

  // Déclarée avant « :id » : sinon « invitations » serait lu comme un
  // identifiant et rejeté par le ParseIntPipe.
  @Get('invitations')
  @ApiOperation({ summary: 'Mes invitations en attente' })
  mesInvitations(@CurrentUser('id') userId: number) {
    return this.groupes.mesInvitations(userId);
  }

  @Get('invitables')
  @ApiOperation({ summary: 'Personnes que je peux inviter' })
  invitables(
    @CurrentUser('id') userId: number,
    @Query('groupeId') groupeId?: string,
  ) {
    return this.groupes.invitables(
      userId,
      groupeId ? parseInt(groupeId, 10) : undefined,
    );
  }

  @Post('invitations/:id/accepter')
  @ApiOperation({ summary: 'Accepter une invitation' })
  accepter(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.groupes.repondre(id, userId, true);
  }

  @Post('invitations/:id/refuser')
  @ApiOperation({ summary: 'Refuser une invitation' })
  refuser(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.groupes.repondre(id, userId, false);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détail d'un groupe" })
  detail(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.groupes.detail(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier un groupe (administrateurs)' })
  modifier(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ModifierGroupeDto,
  ) {
    return this.groupes.modifier(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un groupe (administrateurs)' })
  supprimer(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.groupes.supprimer(id, userId);
  }

  @Post(':id/quitter')
  @ApiOperation({ summary: 'Quitter un groupe' })
  quitter(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.groupes.quitter(id, userId);
  }

  @Post(':id/invitations')
  @ApiOperation({ summary: 'Inviter des personnes (administrateurs)' })
  inviter(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InviterDto,
  ) {
    return this.groupes.inviter(id, userId, dto);
  }

  @Patch(':id/membres/:cibleId')
  @ApiOperation({ summary: "Changer le rôle d'un membre (administrateurs)" })
  changerRole(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('cibleId', ParseIntPipe) cibleId: number,
    @Body() dto: RoleMembreDto,
  ) {
    return this.groupes.changerRole(id, userId, cibleId, dto.role);
  }

  @Delete(':id/membres/:cibleId')
  @ApiOperation({ summary: 'Retirer un membre (administrateurs)' })
  retirerMembre(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('cibleId', ParseIntPipe) cibleId: number,
  ) {
    return this.groupes.retirerMembre(id, userId, cibleId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: "Messages d'un groupe" })
  messages(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.groupes.messages(
      id,
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Envoyer un message au groupe' })
  envoyer(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MessageGroupeDto,
  ) {
    return this.groupes.envoyer(id, userId, dto);
  }

  @Delete(':id/messages/:messageId')
  @ApiOperation({ summary: 'Supprimer un message' })
  supprimerMessage(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ) {
    return this.groupes.supprimerMessage(id, userId, messageId);
  }
}
