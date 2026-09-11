import { Module } from '@nestjs/common';
import { AgentsIaController } from './agents-ia.controller';
import { AgentsIaService } from './agents-ia.service';

/** Statistiques d'usage de l'assistant et de l'extracteur de CV. */
@Module({
  controllers: [AgentsIaController],
  providers: [AgentsIaService],
})
export class AgentsIaModule {}
