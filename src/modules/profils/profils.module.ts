import { Module } from '@nestjs/common';
import { ProfilsController } from './profils.controller';
import { ProfilsService } from './profils.service';
import { CVModule } from '../cv/cv.module';

/**
 * Sourcing de candidats par les partenaires.
 *
 * Module distinct du module CV, qui sert le membre sur son propre CV : les deux
 * lisent la même table mais ne répondent pas à la même question, et surtout pas
 * aux mêmes personnes. Les séparer évite qu'une projection destinée au
 * propriétaire du CV se retrouve un jour servie à un recruteur.
 */
@Module({
  imports: [CVModule],
  controllers: [ProfilsController],
  providers: [ProfilsService],
})
export class ProfilsModule {}
