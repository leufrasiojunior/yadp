import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { PiholeConfigController } from "./pihole-config.controller";
import { PiholeConfigService } from "./pihole-config.service";

@Module({
  imports: [AuditModule, PiholeModule, SessionModule],
  controllers: [PiholeConfigController],
  providers: [PiholeConfigService],
})
export class PiholeConfigModule {}
