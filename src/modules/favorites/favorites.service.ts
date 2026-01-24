import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async add(userId: number, offreId: number) {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_offreId: { userId, offreId } },
    });

    if (existing) {
      throw new ConflictException('Cette offre est déjà dans vos favoris');
    }

    return this.prisma.favorite.create({
      data: { userId, offreId },
      include: {
        offre: {
          select: { id: true, titre: true, typeOffre: true, entreprise: true },
        },
      },
    });
  }

  async remove(userId: number, offreId: number) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_offreId: { userId, offreId } },
    });

    if (!favorite) {
      throw new NotFoundException('Favori non trouvé');
    }

    await this.prisma.favorite.delete({
      where: { userId_offreId: { userId, offreId } },
    });

    return { message: 'Favori supprimé avec succès' };
  }

  async findByUser(userId: number) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        offre: {
          include: {
            auteur: { select: { id: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async isFavorite(userId: number, offreId: number) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_offreId: { userId, offreId } },
    });
    return { isFavorite: !!favorite };
  }
}
