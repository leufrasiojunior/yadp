import { Module } from "@nestjs/common";

import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [PiholeModule, SessionModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
