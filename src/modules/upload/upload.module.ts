import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { PrismaModule } from '../../prisma/prisma.module';

const uploadDir = join(process.cwd(), 'uploads');

// Create uploads directory if it doesn't exist
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const subDir = join(uploadDir, 'offres');
          if (!existsSync(subDir)) {
            mkdirSync(subDir, { recursive: true });
          }
          cb(null, subDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
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
