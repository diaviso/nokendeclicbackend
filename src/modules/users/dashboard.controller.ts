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
    // Tous les comptages portent sur les seules offres validées : un dépôt de
    // partenaire en attente de relecture n'est visible de personne, et le
    // compter gonflerait un total sur lequel l'utilisateur ne peut pas cliquer.
    const publiees = { statutModeration: 'PUBLIEE' as const };

    const [
      totalOffres,
      totalFavorites,
      totalRetours,
      offresByType,
      recentOffres,
    ] = await Promise.all([
      this.prisma.offre.count({ where: publiees }),
      this.prisma.favorite.count({ where: { userId } }),
      this.prisma.retour.count({ where: { auteurId: userId } }),
      this.prisma.offre.groupBy({
        by: ['typeOffreId'],
        where: publiees,
        _count: { typeOffreId: true },
      }),
      this.prisma.offre.findMany({
        where: publiees,
        take: 5,
        orderBy: { datePublication: 'desc' },
        include: {
          auteur: { select: { id: true, username: true, pictureUrl: true } },
          typeOffre: {
            select: { id: true, code: true, libelle: true, icone: true, couleur: true },
          },
        },
      }),
    ]);

    const types = await this.prisma.typeOffre.findMany({
      select: { id: true, code: true },
    });
    const codeParType = new Map(types.map((t) => [t.id, t.code]));

    return {
      totalOffres,
      totalFavorites,
      totalRetours,
      // Indexé par code de type plutôt que par identifiant : le client affiche
      // des libellés, et les codes restent stables même si un type est renommé.
      offresByType: offresByType.reduce<Record<string, number>>((acc, item) => {
        const code = codeParType.get(item.typeOffreId);
        if (code) acc[code] = item._count.typeOffreId;
        return acc;
      }, {}),
      recentOffres,
    };
  }
}
