import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OffresController } from './offres.controller';
import { OffresService } from './offres.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { TypesOffresModule } from '../types-offres/types-offres.module';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    TypesOffresModule,
    MulterModule.register({
      // En mémoire, puis envoi vers R2 (voir StorageService).
      storage: memoryStorage(),
      // Documents et images de couverture passent par le même module : le
      // contrôle fin du type se fait dans le contrôleur, selon l'endpoint.
      fileFilter: (req, file, cb) => {
        const acceptes = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
        ];
        if (acceptes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Formats acceptés : PDF, JPEG, PNG, WebP'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  ],
  controllers: [OffresController],
  providers: [OffresService],
  exports: [OffresService],
})
export class OffresModule {}
