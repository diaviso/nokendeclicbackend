import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { Workbook } from 'exceljs';
import { CurrentUser, Roles } from '../../common';
import { RolesGuard } from '../../common/guards';
import { ExportsService } from './exports.service';

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Exports Excel de la console d'administration.
 *
 * Le classeur est construit ici plutôt que dans le navigateur : les colonnes y
 * sont typées — dates, nombres, pourcentages — et les données personnelles ne
 * quittent le serveur que sous forme de fichier, à la demande d'un
 * administrateur identifié, ce que le journal consigne.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('ADMIN' as any)
@Controller('api/admin/exports')
export class ExportsController {
  private readonly journal = new Logger(ExportsController.name);

  constructor(private readonly exports: ExportsService) {}

  @Get('utilisateurs')
  @ApiOperation({ summary: 'Comptes inscrits : profil, contact et activité' })
  @ApiProduces(XLSX)
  utilisateurs(@CurrentUser('id') adminId: number, @Res() reponse: Response) {
    return this.envoyer(reponse, 'utilisateurs', adminId, () =>
      this.exports.utilisateurs(),
    );
  }

  @Get('offres')
  @ApiOperation({ summary: 'Offres : fiche complète et engagement' })
  @ApiProduces(XLSX)
  offres(@CurrentUser('id') adminId: number, @Res() reponse: Response) {
    return this.envoyer(reponse, 'offres', adminId, () =>
      this.exports.offres(),
    );
  }

  @Get('rapport')
  @ApiOperation({ summary: 'Rapport statistique, une feuille par indicateur' })
  @ApiProduces(XLSX)
  @ApiQuery({ name: 'mois', required: false, type: Number })
  rapport(
    @CurrentUser('id') adminId: number,
    @Res() reponse: Response,
    @Query('mois') mois?: string,
  ) {
    const valeur = mois === undefined || mois === '' ? 12 : Number(mois);
    if (!Number.isInteger(valeur) || valeur < 3 || valeur > 36) {
      throw new BadRequestException(
        'La période du rapport doit compter entre 3 et 36 mois.',
      );
    }
    return this.envoyer(reponse, `rapport-${valeur}-mois`, adminId, () =>
      this.exports.rapport(valeur),
    );
  }

  @Get('questions-assistant')
  @ApiOperation({ summary: "Questions posées à l'assistant IA" })
  @ApiProduces(XLSX)
  @ApiQuery({
    name: 'jours',
    required: false,
    type: Number,
    description: 'Taille de la période en jours ; 0 pour tout l’historique',
  })
  questionsAssistant(
    @CurrentUser('id') adminId: number,
    @Res() reponse: Response,
    @Query('jours') jours?: string,
  ) {
    const valeur = jours === undefined || jours === '' ? 0 : Number(jours);
    if (!Number.isInteger(valeur) || valeur < 0 || valeur > 3650) {
      throw new BadRequestException(
        'La période doit être un nombre entier de jours, entre 0 et 3650.',
      );
    }
    return this.envoyer(reponse, 'questions-assistant', adminId, () =>
      this.exports.questionsAssistant(valeur),
    );
  }

  private async envoyer(
    reponse: Response,
    nom: string,
    adminId: number,
    fabriquer: () => Promise<Workbook>,
  ) {
    const classeur = await fabriquer();
    const fichier = `noken-${nom}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    // Chaque export fait sortir des données de la plateforme, dont certaines
    // personnelles : qui l'a demandé, et quand, doit pouvoir se retrouver.
    this.journal.log(
      `Export « ${nom} » demandé par l'administrateur ${adminId}`,
    );

    reponse.setHeader('Content-Type', XLSX);
    reponse.setHeader(
      'Content-Disposition',
      `attachment; filename="${fichier}"`,
    );
    reponse.setHeader('Cache-Control', 'no-store');
    await classeur.xlsx.write(reponse);
    reponse.end();
  }
}
