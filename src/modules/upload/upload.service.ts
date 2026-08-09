import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class UploadService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async addFileToOffre(
    offreId: number,
    file: Express.Multer.File,
    userId: number,
    userRole: string,
  ) {
    // Verify offre exists and user has permission
    const offre = await this.prisma.offre.findUnique({
      where: { id: offreId },
    });

    if (!offre) {
      throw new NotFoundException('Offre non trouvée');
    }

    if (offre.auteurId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas modifier cette offre');
    }

    const stored = await this.storage.upload(file, 'offres');

    return this.prisma.offreFichier.create({
      data: {
        nom: stored.originalName,
        url: stored.url,
        type: stored.mimetype,
        taille: stored.size,
        offreId,
      },
    });
  }

  async getOffreFichiers(offreId: number) {
    return this.prisma.offreFichier.findMany({
      where: { offreId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteFichier(fichierId: number, userId: number, userRole: string) {
    const fichier = await this.prisma.offreFichier.findUnique({
      where: { id: fichierId },
      include: { offre: true },
    });

    if (!fichier) {
      throw new NotFoundException('Fichier non trouvé');
    }

    if (fichier.offre.auteurId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas supprimer ce fichier');
    }

    // L'objet distant est supprimé avant l'enregistrement ; un échec y est
    // journalisé sans interrompre la suppression en base.
    await this.storage.delete(fichier.url);

    await this.prisma.offreFichier.delete({
      where: { id: fichierId },
    });

    return { message: 'Fichier supprimé avec succès' };
  }

  async updateFichierName(
    fichierId: number,
    newName: string,
    userId: number,
    userRole: string,
  ) {
    const fichier = await this.prisma.offreFichier.findUnique({
      where: { id: fichierId },
      include: { offre: true },
    });

    if (!fichier) {
      throw new NotFoundException('Fichier non trouvé');
    }

    if (fichier.offre.auteurId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez pas modifier ce fichier');
    }

    return this.prisma.offreFichier.update({
      where: { id: fichierId },
      data: { nom: newName },
    });
  }
}
