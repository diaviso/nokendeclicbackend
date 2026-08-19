import { Module } from '@nestjs/common';
import { PartenaireController } from './partenaire.controller';
import { PartenaireService } from './partenaire.service';
import { StorageModule } from '../storage/storage.module';

/**
 * Espace propre aux structures partenaires : fiche d'entreprise, candidats mis
 * de côté, et vitrine publique alimentée par ces mêmes fiches.
 */
@Module({
  imports: [StorageModule],
  controllers: [PartenaireController],
  providers: [PartenaireService],
})
export class PartenaireModule {}
