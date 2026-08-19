import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    MulterModule.register({
      // En mémoire : le fichier est ensuite poussé vers R2. Le disque du
      // conteneur est éphémère, y écrire revenait à perdre les fichiers à
      // chaque déploiement.
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        // Couples (extension -> types MIME acceptés) : le type déclaré ET l'extension
        // doivent être cohérents. Un OU laisserait passer n'importe quel binaire
        // déguisé derrière une extension autorisée, et inversement.
        //
        // Exclusions volontaires :
        // - SVG : peut embarquer <script>, et les fichiers sont servis tels quels
        //   depuis l'origine de l'API => XSS stocké.
        // - application/octet-stream : type par défaut de tout binaire non identifié,
        //   l'accepter revient à désactiver le filtre.
        // - archives (.zip/.rar) : contenu non inspectable, aucun usage métier ici.
        const allowedTypes: Record<string, string[]> = {
          '.jpg': ['image/jpeg'],
          '.jpeg': ['image/jpeg'],
          '.png': ['image/png'],
          '.gif': ['image/gif'],
          '.webp': ['image/webp'],
          '.bmp': ['image/bmp'],
          '.tiff': ['image/tiff'],
          '.pdf': ['application/pdf'],
          '.doc': ['application/msword'],
          '.docx': [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ],
          '.xls': ['application/vnd.ms-excel'],
          '.xlsx': [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ],
          '.ppt': ['application/vnd.ms-powerpoint'],
          '.pptx': [
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          ],
          '.txt': ['text/plain'],
          '.csv': ['text/csv', 'text/plain', 'application/csv'],
        };

        const ext = extname(file.originalname).toLowerCase();
        const expectedMimes = allowedTypes[ext];

        if (expectedMimes && expectedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error(
              `Type de fichier non autorisé: ${file.mimetype} (${ext || 'sans extension'})`,
            ),
            false,
          );
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
