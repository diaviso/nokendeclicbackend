import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto, ChangeRoleDto, ChangeStatutDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        pictureUrl: true,
        firstName: true,
        lastName: true,
        statutProfessionnel: true,
        pays: true,
        commune: true,
        quartier: true,
        sexe: true,
        dateNaissance: true,
        adresse: true,
        telephone: true,
        handicap: true,
        typeHandicap: true,
        createdAt: true,
        isGoogleLogin: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        pictureUrl: true,
        firstName: true,
        lastName: true,
        statutProfessionnel: true,
        pays: true,
        commune: true,
        quartier: true,
        sexe: true,
        dateNaissance: true,
        adresse: true,
        telephone: true,
        handicap: true,
        typeHandicap: true,
        createdAt: true,
        isGoogleLogin: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: number, dto: UpdateUserDto, currentUserId: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.id !== currentUserId) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre profil');
    }

    // Handle dateNaissance conversion if provided
    const updateData: any = { ...dto };
    if (dto.dateNaissance) {
      updateData.dateNaissance = new Date(dto.dateNaissance);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        pictureUrl: true,
        firstName: true,
        lastName: true,
        statutProfessionnel: true,
        pays: true,
        commune: true,
        quartier: true,
        sexe: true,
        dateNaissance: true,
        adresse: true,
        telephone: true,
        handicap: true,
        typeHandicap: true,
      },
    });
  }

  async toggleActive(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        email: true,
        username: true,
        isActive: true,
      },
    });
  }

  async changeRole(id: number, dto: ChangeRoleDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role as any },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
      },
    });
  }

  async changeStatutProfessionnel(id: number, dto: ChangeStatutDto, currentUserId: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.id !== currentUserId) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre statut');
    }

    return this.prisma.user.update({
      where: { id },
      data: { statutProfessionnel: dto.statutProfessionnel as any },
      select: {
        id: true,
        email: true,
        username: true,
        statutProfessionnel: true,
      },
    });
  }

  async updateProfilePicture(id: number, pictureUrl: string, currentUserId: number) {
    if (id !== currentUserId) {
      throw new ForbiddenException('Vous ne pouvez modifier que votre propre photo');
    }

    return this.prisma.user.update({
      where: { id },
      data: { pictureUrl },
      select: {
        id: true,
        pictureUrl: true,
      },
    });
  }

  async delete(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Utilisateur supprimé avec succès' };
  }

  async count() {
    return this.prisma.user.count();
  }

  async countByRole() {
    const [admins, membres, partenaires] = await Promise.all([
      this.prisma.user.count({ where: { role: 'ADMIN' } }),
      this.prisma.user.count({ where: { role: 'MEMBRE' } }),
      this.prisma.user.count({ where: { role: 'PARTENAIRE' } }),
    ]);

    return { admins, membres, partenaires };
  }
}
