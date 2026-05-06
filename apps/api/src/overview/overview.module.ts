import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { OverviewController } from "./overview.controller";
import { OverviewService } from "./overview.service";

@Module({
  imports: [NotificationsModule, PiholeModule, SessionModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
