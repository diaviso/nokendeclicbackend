import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    MulterModule.register({
      // En mémoire, puis envoi vers R2 (voir StorageService).
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(null, true);
        } else {
          cb(new Error('Format de fichier non supporté'), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  ],
  controllers: [UsersController, DashboardController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
