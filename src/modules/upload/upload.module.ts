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
        // Extended list of allowed MIME types including variations
        const allowedMimes = [
          // Images
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/bmp',
          'image/svg+xml',
          'image/tiff',
          'image/x-icon',
          'image/vnd.microsoft.icon',
          // PDF
          'application/pdf',
          // Documents
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          // Text
          'text/plain',
          'text/csv',
          // Archives (optional)
          'application/zip',
          'application/x-zip-compressed',
          'application/x-rar-compressed',
          // Fallback for unknown binary
          'application/octet-stream',
        ];
        
        // Also check by file extension as fallback
        const allowedExtensions = [
          '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico', '.tiff',
          '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
          '.txt', '.csv', '.zip', '.rar'
        ];
        
        const ext = extname(file.originalname).toLowerCase();
        
        if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error(`Type de fichier non autorisé: ${file.mimetype} (${ext})`), false);
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
