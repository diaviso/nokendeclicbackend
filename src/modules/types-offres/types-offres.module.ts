import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { TypesOffresService } from './types-offres.service';
import {
  AdminTypesOffresController,
  TypesOffresController,
} from './types-offres.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TypesOffresController, AdminTypesOffresController],
  providers: [TypesOffresService],
  // Exporté : OffresService s'en sert pour valider les valeurs soumises.
  exports: [TypesOffresService],
})
export class TypesOffresModule {}
