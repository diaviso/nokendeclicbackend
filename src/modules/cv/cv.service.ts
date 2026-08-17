import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
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
    // Les rubriques sont sorties du lot : Prisma attend une valeur JSON, et le
    // tableau typé du DTO n'en est pas une aux yeux du compilateur. La
    // conversion est explicite plutôt que masquée par un `any` sur tout l'objet.
    const { experiences, formations, rubriques, ...cvData } = dto;
    const rubriquesJson = rubriques as Prisma.InputJsonValue | undefined;

    return this.prisma.cV.create({
      data: {
        ...cvData,
        ...(rubriquesJson !== undefined ? { rubriques: rubriquesJson } : {}),
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

    // Les rubriques sont sorties du lot : Prisma attend une valeur JSON, et le
    // tableau typé du DTO n'en est pas une aux yeux du compilateur. La
    // conversion est explicite plutôt que masquée par un `any` sur tout l'objet.
    const { experiences, formations, rubriques, ...cvData } = dto;
    const rubriquesJson = rubriques as Prisma.InputJsonValue | undefined;

    // Delete existing experiences and formations
    await this.prisma.experience.deleteMany({ where: { cvId: existingCV.id } });
    await this.prisma.formation.deleteMany({ where: { cvId: existingCV.id } });

    return this.prisma.cV.update({
      where: { userId },
      data: {
        ...cvData,
        ...(rubriquesJson !== undefined ? { rubriques: rubriquesJson } : {}),
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

  /**
   * Projection d'un CV vue par un recruteur.
   *
   * Ni téléphone, ni adresse, ni code postal : le membre a accepté d'être
   * repéré, pas d'être appelé. La prise de contact passe par la messagerie
   * interne, où il reste libre de ne pas répondre — et où la sollicitation
   * laisse une trace. La ville reste, parce qu'elle décide souvent de la
   * candidature, et qu'elle ne permet pas de joindre quelqu'un.
   */
  static readonly SELECT_RECRUTEUR = {
    id: true,
    titreProfessionnel: true,
    resume: true,
    ville: true,
    pays: true,
    linkedin: true,
    siteWeb: true,
    github: true,
    competences: true,
    langues: true,
    certifications: true,
    interets: true,
    rubriques: true,
    dateModification: true,
    userId: true,
    user: {
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        pictureUrl: true,
        statutProfessionnel: true,
        region: true,
      },
    },
  };

  async findPublicById(userId: number) {
    const cv = await this.prisma.cV.findFirst({
      where: { userId, estPublic: true },
      select: {
        ...CVService.SELECT_RECRUTEUR,
        experiences: { orderBy: { dateDebut: 'desc' as const } },
        formations: { orderBy: { dateDebut: 'desc' as const } },
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
      select: CVService.SELECT_RECRUTEUR,
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
