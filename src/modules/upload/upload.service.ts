import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  getFileUrl(filename: string): string {
    const baseUrl = this.configService.get<string>('app.baseUrl') || 'http://localhost:3000';
    return `${baseUrl}/uploads/offres/${filename}`;
  }

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

    const fichier = await this.prisma.offreFichier.create({
      data: {
        nom: file.originalname,
        url: this.getFileUrl(file.filename),
        type: file.mimetype,
        taille: file.size,
        offreId,
      },
    });

    return fichier;
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

    // Extract filename from URL and delete physical file
    const urlParts = fichier.url.split('/');
    const filename = urlParts[urlParts.length - 1];
    const filePath = join(process.cwd(), 'uploads', 'offres', filename);

    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

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
