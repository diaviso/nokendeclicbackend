import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCVDto, UpdateCVDto } from './dto';

@Injectable()
export class CVService {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: number) {
    const cv = await this.prisma.cV.findUnique({
      where: { userId },
      include: {
        experiences: { orderBy: { dateDebut: 'desc' } },
        formations: { orderBy: { dateDebut: 'desc' } },
        user: {
          select: { id: true, username: true, email: true, firstName: true, lastName: true, pictureUrl: true },
        },
      },
    });

    return { hasCV: !!cv, cv };
  }

  async create(userId: number, dto: CreateCVDto) {
    const { experiences, formations, ...cvData } = dto;

    return this.prisma.cV.create({
      data: {
        ...cvData,
        userId,
        experiences: experiences
          ? {
              create: experiences.map((exp) => ({
                ...exp,
                dateDebut: new Date(exp.dateDebut),
                dateFin: exp.dateFin ? new Date(exp.dateFin) : null,
              })),
            }
          : undefined,
        formations: formations
          ? {
              create: formations.map((form) => ({
                ...form,
                dateDebut: new Date(form.dateDebut),
                dateFin: form.dateFin ? new Date(form.dateFin) : null,
              })),
            }
          : undefined,
      },
      include: {
        experiences: true,
        formations: true,
      },
    });
  }

  async update(userId: number, dto: UpdateCVDto) {
    const existingCV = await this.prisma.cV.findUnique({ where: { userId } });

    if (!existingCV) {
      return this.create(userId, dto);
    }

    const { experiences, formations, ...cvData } = dto;

    // Delete existing experiences and formations
    await this.prisma.experience.deleteMany({ where: { cvId: existingCV.id } });
    await this.prisma.formation.deleteMany({ where: { cvId: existingCV.id } });

    return this.prisma.cV.update({
      where: { userId },
      data: {
        ...cvData,
        experiences: experiences
          ? {
              create: experiences.map((exp) => ({
                ...exp,
                dateDebut: new Date(exp.dateDebut),
                dateFin: exp.dateFin ? new Date(exp.dateFin) : null,
              })),
            }
          : undefined,
        formations: formations
          ? {
              create: formations.map((form) => ({
                ...form,
                dateDebut: new Date(form.dateDebut),
                dateFin: form.dateFin ? new Date(form.dateFin) : null,
              })),
            }
          : undefined,
      },
      include: {
        experiences: true,
        formations: true,
      },
    });
  }

  async delete(userId: number) {
    const cv = await this.prisma.cV.findUnique({ where: { userId } });

    if (!cv) {
      throw new NotFoundException('CV non trouvé');
    }

    await this.prisma.cV.delete({ where: { userId } });
    return { message: 'CV supprimé avec succès' };
  }

  async findPublicById(userId: number) {
    const cv = await this.prisma.cV.findFirst({
      where: { userId, estPublic: true },
      include: {
        experiences: { orderBy: { dateDebut: 'desc' } },
        formations: { orderBy: { dateDebut: 'desc' } },
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, pictureUrl: true },
        },
      },
    });

    if (!cv) {
      throw new NotFoundException('CV non trouvé ou non public');
    }

    return cv;
  }

  async findAllPublic() {
    return this.prisma.cV.findMany({
      where: { estPublic: true },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true, pictureUrl: true },
        },
      },
      orderBy: { dateModification: 'desc' },
    });
  }

  async countPublic() {
    return this.prisma.cV.count({ where: { estPublic: true } });
  }

  async findByCompetence(competence: string) {
    return this.prisma.cV.findMany({
      where: {
        estPublic: true,
        competences: { has: competence },
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    });
  }
}
