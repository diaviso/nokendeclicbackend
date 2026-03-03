import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SeedOffresController } from './seed-offres.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [AdminController, SeedOffresController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
