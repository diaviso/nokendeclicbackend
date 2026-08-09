import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OffresController } from './offres.controller';
import { OffresService } from './offres.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    MulterModule.register({
      // En mémoire, puis envoi vers R2 (voir StorageService).
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new Error('Seuls les fichiers PDF sont acceptés'), false);
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
