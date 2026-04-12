import { Global, Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { AuditService } from "./audit.service";

@Global()
@Module({
  imports: [NotificationsModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
