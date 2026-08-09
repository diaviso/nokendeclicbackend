import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LikesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Bascule le « j'aime » d'un utilisateur sur une offre.
   *
   * La contrainte d'unicité en base porte la règle « un like par utilisateur
   * et par offre » : un double clic concurrent ne peut pas créer de doublon,
   * l'erreur P2002 est simplement absorbée.
   */
  async toggle(userId: number, offreId: number) {
    const offre = await this.prisma.offre.findUnique({
      where: { id: offreId },
      select: { id: true },
    });
    if (!offre) throw new NotFoundException('Offre non trouvée');

    const existant = await this.prisma.offreLike.findUnique({
      where: { userId_offreId: { userId, offreId } },
    });

    if (existant) {
      await this.prisma.offreLike.delete({ where: { id: existant.id } });
    } else {
      try {
        await this.prisma.offreLike.create({ data: { userId, offreId } });
      } catch (error) {
        // P2002 : le like a été créé entre-temps par une requête concurrente.
        // L'état voulu est atteint, il n'y a rien à signaler.
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }

    const total = await this.prisma.offreLike.count({ where: { offreId } });
    return { liked: !existant, total };
  }

  async statut(userId: number | undefined, offreId: number) {
    const [total, mien] = await Promise.all([
      this.prisma.offreLike.count({ where: { offreId } }),
      userId
        ? this.prisma.offreLike.findUnique({
            where: { userId_offreId: { userId, offreId } },
            select: { id: true },
          })
        : null,
    ]);

    return { total, liked: Boolean(mien) };
  }

  /** Offres aimées par l'utilisateur, pour l'affichage des listes. */
  async mesLikes(userId: number, offreIds: number[]) {
    if (!offreIds.length) return [];
    const likes = await this.prisma.offreLike.findMany({
      where: { userId, offreId: { in: offreIds } },
      select: { offreId: true },
    });
    return likes.map((like) => like.offreId);
  }
}
