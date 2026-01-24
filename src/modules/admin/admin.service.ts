import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ==================== USERS ====================

  async getAllUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          statutProfessionnel: true,
          pictureUrl: true,
          createdAt: true,
          _count: { select: { retours: true, offres: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        cv: true,
        retours: { take: 5, orderBy: { datePublication: 'desc' } },
        offres: { take: 5, orderBy: { datePublication: 'desc' } },
        _count: { select: { retours: true, offres: true, favorites: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  async updateUserRole(id: number, role: string) {
    return this.prisma.user.update({
      where: { id },
      data: { role: role as any },
    });
  }

  async toggleUserActive(id: number, isActive: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  async deleteUser(id: number) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Utilisateur supprimé avec succès' };
  }

  // ==================== OFFRES ====================

  async getAllOffres(page = 1, limit = 20, search?: string, typeOffre?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { titre: { contains: search, mode: 'insensitive' } },
        { entreprise: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (typeOffre) {
      where.typeOffre = typeOffre;
    }

    const [offres, total] = await Promise.all([
      this.prisma.offre.findMany({
        where,
        skip,
        take: limit,
        orderBy: { datePublication: 'desc' },
        include: {
          auteur: { select: { id: true, username: true, email: true } },
          _count: { select: { retours: true } },
        },
      }),
      this.prisma.offre.count({ where }),
    ]);

    return {
      data: offres,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOffreById(id: number) {
    const offre = await this.prisma.offre.findUnique({
      where: { id },
      include: {
        auteur: { select: { id: true, username: true, email: true } },
        retours: {
          take: 10,
          orderBy: { datePublication: 'desc' },
          include: { auteur: { select: { id: true, username: true } } },
        },
        _count: { select: { retours: true } },
      },
    });

    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    return offre;
  }

  async deleteOffre(id: number) {
    await this.prisma.offre.delete({ where: { id } });
    return { message: 'Offre supprimée avec succès' };
  }

  // ==================== USER DASHBOARD STATS ====================

  async getUserDashboardStats(userId: number) {
    const [
      totalOffres,
      totalFavorites,
      totalRetours,
      offresByType,
    ] = await Promise.all([
      this.prisma.offre.count(),
      this.prisma.favorite.count({ where: { userId } }),
      this.prisma.retour.count({ where: { auteurId: userId } }),
      this.prisma.offre.groupBy({
        by: ['typeOffre'],
        _count: { typeOffre: true },
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
    };
  }

  // ==================== STATISTICS ====================

  async getStatistics() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      totalOffres,
      totalRetours,
      offresByType,
      offresBySecteur,
      topOffres,
      newUsersThisMonth,
      newOffresThisMonth,
      newRetoursThisMonth,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.offre.count(),
      this.prisma.retour.count(),
      this.prisma.offre.groupBy({
        by: ['typeOffre'],
        _count: { typeOffre: true },
      }),
      this.prisma.offre.groupBy({
        by: ['secteur'],
        _count: { secteur: true },
        orderBy: { _count: { secteur: 'desc' } },
        take: 10,
      }),
      this.prisma.offre.findMany({
        take: 5,
        orderBy: { retours: { _count: 'desc' } },
        include: {
          auteur: { select: { id: true, username: true } },
          _count: { select: { retours: true } },
        },
      }),
      this.prisma.user.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      this.prisma.offre.count({
        where: { datePublication: { gte: startOfMonth } },
      }),
      this.prisma.retour.count({
        where: { datePublication: { gte: startOfMonth } },
      }),
    ]);

    return {
      totals: {
        users: totalUsers,
        offres: totalOffres,
        retours: totalRetours,
      },
      offresByType: offresByType.reduce((acc, item) => {
        acc[item.typeOffre] = item._count.typeOffre;
        return acc;
      }, {} as Record<string, number>),
      offresBySecteur: offresBySecteur.map((item) => ({
        secteur: item.secteur,
        count: item._count.secteur,
      })),
      topOffres: topOffres.map((offre) => ({
        id: offre.id,
        titre: offre.titre,
        auteur: offre.auteur.username,
        retoursCount: offre._count.retours,
      })),
      thisMonth: {
        newUsers: newUsersThisMonth,
        newOffres: newOffresThisMonth,
        newRetours: newRetoursThisMonth,
      },
    };
  }
}
