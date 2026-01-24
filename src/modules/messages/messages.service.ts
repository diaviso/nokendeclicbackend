import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMessageDto, ReplyMessageDto } from './dto';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMessageDto, expediteurId: number) {
    return this.prisma.message.create({
      data: {
        ...dto,
        expediteurId,
      },
      include: {
        expediteur: { select: { id: true, username: true, pictureUrl: true } },
      },
    });
  }

  async findAll(userId: number, userRole: string) {
    if (userRole === 'ADMIN') {
      return this.prisma.message.findMany({
        include: {
          expediteur: { select: { id: true, username: true, email: true, pictureUrl: true } },
          reponses: {
            include: { auteur: { select: { id: true, username: true } } },
            orderBy: { dateCreation: 'asc' },
          },
        },
        orderBy: { dateEnvoi: 'desc' },
      });
    }

    return this.prisma.message.findMany({
      where: { expediteurId: userId },
      include: {
        reponses: {
          include: { auteur: { select: { id: true, username: true } } },
          orderBy: { dateCreation: 'asc' },
        },
      },
      orderBy: { dateEnvoi: 'desc' },
    });
  }

  async findById(id: number, userId: number, userRole: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: {
        expediteur: { select: { id: true, username: true, email: true, pictureUrl: true } },
        reponses: {
          include: { auteur: { select: { id: true, username: true } } },
          orderBy: { dateCreation: 'asc' },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message non trouvé');
    }

    if (userRole !== 'ADMIN' && message.expediteurId !== userId) {
      throw new ForbiddenException('Accès non autorisé');
    }

    return message;
  }

  async markAsRead(id: number) {
    return this.prisma.message.update({
      where: { id },
      data: { estLu: true },
    });
  }

  async reply(id: number, dto: ReplyMessageDto, auteurId: number) {
    const message = await this.prisma.message.findUnique({ where: { id } });

    if (!message) {
      throw new NotFoundException('Message non trouvé');
    }

    await this.prisma.reponseMessage.create({
      data: {
        contenu: dto.contenu,
        messageId: id,
        auteurId,
      },
    });

    await this.markAsRead(id);

    return this.findById(id, auteurId, 'ADMIN');
  }

  async delete(id: number) {
    const message = await this.prisma.message.findUnique({ where: { id } });

    if (!message) {
      throw new NotFoundException('Message non trouvé');
    }

    await this.prisma.message.delete({ where: { id } });
    return { message: 'Message supprimé avec succès' };
  }

  async getUnreadCount() {
    return this.prisma.message.count({ where: { estLu: false } });
  }
}
