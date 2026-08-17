import { Module } from '@nestjs/common';
import { DocumentExtractionService } from './document-extraction.service';

/**
 * Lecture de documents par modèle multimodal.
 *
 * Le service est générique : il ne connaît ni le CV ni aucun autre métier, il
 * prend un fichier et un schéma. Les modules métier fournissent le schéma et
 * les consignes.
 */
@Module({
  providers: [DocumentExtractionService],
  exports: [DocumentExtractionService],
})
export class ExtractionModule {}
