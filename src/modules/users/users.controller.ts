import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
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
import { UpdateUserDto, ChangeRoleDto, ChangeStatutDto } from './dto';
import { CurrentUser, Roles } from '../../common';
import { RolesGuard } from '../../common/guards';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('api/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Liste tous les utilisateurs' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Obtenir l\'utilisateur connecté' })
  async getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un utilisateur par ID' })
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
    const pictureUrl = `/uploads/profiles/${file.filename}`;
    return this.usersService.updateProfilePicture(id, pictureUrl, currentUserId);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Uploader une photo de profil (alias)' })
  async uploadPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') currentUserId: number,
  ) {
    const pictureUrl = `/uploads/profiles/${file.filename}`;
    return this.usersService.updateProfilePicture(id, pictureUrl, currentUserId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any)
  @ApiOperation({ summary: 'Supprimer un utilisateur (Admin)' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.delete(id);
  }
}
