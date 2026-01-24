import { Module, forwardRef } from '@nestjs/common';
import { RetoursController } from './retours.controller';
import { RetoursService } from './retours.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  controllers: [RetoursController],
  providers: [RetoursService],
  exports: [RetoursService],
})
export class RetoursModule {}
