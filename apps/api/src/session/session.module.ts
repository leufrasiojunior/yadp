import { Module } from "@nestjs/common";

import { AppConfigEventsModule } from "../common/app-config/app-config-events.module";
import { PiholeModule } from "../pihole/pihole.module";
import { CsrfGuard } from "./csrf.guard";
import { SessionController } from "./session.controller";
import { SessionGuard } from "./session.guard";
import { SessionService } from "./session.service";

@Module({
  imports: [AppConfigEventsModule, PiholeModule],
  controllers: [SessionController],
  providers: [CsrfGuard, SessionGuard, SessionService],
  exports: [CsrfGuard, SessionGuard, SessionService],
})
export class SessionModule {}
