import { BadRequestException, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediasController } from './medias.controller';
import { MediasService, TYPES_IMAGES } from './medias.service';

@Module({
  imports: [
    MulterModule.register({
      // En mémoire : l'image est recompressée avant de partir vers R2.
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (TYPES_IMAGES.includes(file.mimetype)) cb(null, true);
        else
          cb(
            new BadRequestException(
              'La couverture doit être une image JPEG, PNG ou WebP',
            ),
            false,
          );
      },
      // Large à dessein : une photo de téléphone pèse souvent 4 à 8 Mo, et
      // elle sera de toute façon réduite à quelques centaines de Ko.
      limits: { fileSize: 12 * 1024 * 1024 },
    }),
  ],
  controllers: [MediasController],
  providers: [MediasService],
  exports: [MediasService],
})
export class MediasModule {}
