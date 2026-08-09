import {
  BadRequestException,
  Controller,
  Get,
  Put,
  Delete,
  Body,
  ForbiddenException,
  Param,
  ParseIntPipe,
  UseGuards,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { StorageService } from '../storage/storage.service';
import { UpdateUserDto, ChangeRoleDto, ChangeStatutDto } from './dto';
import { CurrentUser, Roles } from '../../common';
import { RolesGuard } from '../../common/guards';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('api/users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private storage: StorageService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Liste tous les utilisateurs (Admin)' })
  async findAll() {
    return this.usersService.findAll();
  }

  // NOTE: cette route doit rester déclarée AVANT `@Get(':id')`,
  // sinon Nest résout `/api/users/me` vers le handler paramétré.
  @Get('me')
  @ApiOperation({ summary: 'Obtenir l\'utilisateur connecté' })
  async getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Obtenir un utilisateur par ID (Admin)' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Mettre à jour son profil' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') currentUserId: number,
  ) {
    return this.usersService.update(id, dto, currentUserId);
  }

  @Put(':id/toggle-active')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Activer/désactiver un utilisateur (Admin)' })
  async toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.toggleActive(id);
  }

  @Put(':id/change-role')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Changer le rôle d\'un utilisateur (Admin)' })
  async changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.usersService.changeRole(id, dto);
  }

  @Put(':id/change-statut-professionnel')
  @ApiOperation({ summary: 'Changer son statut professionnel' })
  async changeStatutProfessionnel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeStatutDto,
    @CurrentUser('id') currentUserId: number,
  ) {
    return this.usersService.changeStatutProfessionnel(id, dto, currentUserId);
  }

  @Post(':id/upload-profile-picture')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Uploader une photo de profil' })
  async uploadProfilePicture(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') currentUserId: number,
  ) {
    return this.storeProfilePicture(id, file, currentUserId);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Uploader une photo de profil (alias)' })
  async uploadPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') currentUserId: number,
  ) {
    return this.storeProfilePicture(id, file, currentUserId);
  }

  private async storeProfilePicture(
    id: number,
    file: Express.Multer.File,
    currentUserId: number,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    // L'autorisation est vérifiée avant l'envoi, pour ne pas stocker un objet
    // que l'appelant n'a pas le droit d'attacher.
    if (id !== currentUserId) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que votre propre photo',
      );
    }

    const stored = await this.storage.upload(file, 'profiles');
    return this.usersService.updateProfilePicture(id, stored.url, currentUserId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Supprimer un utilisateur (Admin)' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.delete(id);
  }
}
