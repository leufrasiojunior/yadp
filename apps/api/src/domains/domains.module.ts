import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../common/prisma/prisma.module";
import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";

@Module({
  imports: [AuditModule, PiholeModule, PrismaModule, SessionModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
