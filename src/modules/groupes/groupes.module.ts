import { Module, forwardRef } from '@nestjs/common';
import { GroupesController } from './groupes.controller';
import { GroupesService } from './groupes.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [GroupesController],
  providers: [GroupesService],
  exports: [GroupesService],
})
export class GroupesModule {}
