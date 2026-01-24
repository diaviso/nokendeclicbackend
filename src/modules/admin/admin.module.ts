import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SeedOffresController } from './seed-offres.controller';

@Module({
  controllers: [AdminController, SeedOffresController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
