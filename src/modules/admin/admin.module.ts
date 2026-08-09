import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationsModule } from '../notifications/notifications.module';

// SeedOffresController a été retiré : il exposait POST /api/admin/seed/offres et
// POST /api/admin/seed/update-urls en @Public(), donc en écriture non authentifiée.
// Le jeu de données de seed est conservé dans prisma/seed-offres.ts, exécuté hors ligne.
@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
