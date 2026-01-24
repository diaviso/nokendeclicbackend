import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../common';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('api/dashboard')
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques du dashboard utilisateur' })
  async getStats(@CurrentUser('id') userId: number) {
    const [
      totalOffres,
      totalFavorites,
      totalRetours,
      offresByType,
      recentOffres,
    ] = await Promise.all([
      this.prisma.offre.count(),
      this.prisma.favorite.count({ where: { userId } }),
      this.prisma.retour.count({ where: { auteurId: userId } }),
      this.prisma.offre.groupBy({
        by: ['typeOffre'],
        _count: { typeOffre: true },
      }),
      this.prisma.offre.findMany({
        take: 5,
        orderBy: { datePublication: 'desc' },
        include: {
          auteur: { select: { id: true, username: true, pictureUrl: true } },
        },
      }),
    ]);

    return {
      totalOffres,
      totalFavorites,
      totalRetours,
      offresByType: offresByType.reduce((acc, item) => {
        acc[item.typeOffre] = item._count.typeOffre;
        return acc;
      }, {} as Record<string, number>),
      recentOffres,
    };
  }
}
