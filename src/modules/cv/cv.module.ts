import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CVController } from './cv.controller';
import { CVService } from './cv.service';
import { CVExtractorService } from './cv-extractor.service';
import { CVCorrectorService } from './cv-corrector.service';

@Module({
  imports: [ConfigModule],
  controllers: [CVController],
  providers: [CVService, CVExtractorService, CVCorrectorService],
  exports: [CVService, CVExtractorService, CVCorrectorService],
})
export class CVModule {}
