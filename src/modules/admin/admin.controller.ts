import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../../common';
import { RolesGuard } from '../../common/guards';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN' as any)
@Controller('api/admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ==================== STATISTICS ====================

  @Get('statistics')
  @ApiOperation({ summary: 'Statistiques de la plateforme' })
  async getStatistics() {
    return this.adminService.getStatistics();
  }

  // ==================== USERS ====================

  @Get('users')
  @ApiOperation({ summary: 'Liste des utilisateurs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Détails d\'un utilisateur' })
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserById(id);
  }

  @Post('users/:id/role')
  @ApiOperation({ summary: 'Modifier le rôle d\'un utilisateur' })
  async updateUserRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: string,
  ) {
    return this.adminService.updateUserRole(id, role);
  }

  @Post('users/:id/toggle-active')
  @ApiOperation({ summary: 'Activer/désactiver un utilisateur' })
  async toggleUserActive(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive') isActive: boolean,
  ) {
    return this.adminService.toggleUserActive(id, isActive);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Supprimer un utilisateur' })
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteUser(id);
  }

  // ==================== OFFRES ====================

  @Get('offres')
  @ApiOperation({ summary: 'Liste des offres' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'typeOffre', required: false, type: String })
  async getOffres(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('typeOffre') typeOffre?: string,
  ) {
    return this.adminService.getAllOffres(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
      typeOffre,
    );
  }

  @Get('offres/:id')
  @ApiOperation({ summary: 'Détails d\'une offre' })
  async getOffreById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getOffreById(id);
  }

  @Delete('offres/:id')
  @ApiOperation({ summary: 'Supprimer une offre' })
  async deleteOffre(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteOffre(id);
  }
}
