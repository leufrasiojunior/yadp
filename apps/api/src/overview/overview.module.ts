import { Module } from "@nestjs/common";

import { AppConfigEventsModule } from "../common/app-config/app-config-events.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { OverviewController } from "./overview.controller";
import { OverviewService } from "./overview.service";

@Module({
  imports: [AppConfigEventsModule, NotificationsModule, PiholeModule, SessionModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
