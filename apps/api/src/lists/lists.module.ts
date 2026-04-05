import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { ListsController } from "./lists.controller";
import { ListsService } from "./lists.service";

@Module({
  imports: [AuditModule, PiholeModule, SessionModule],
  controllers: [ListsController],
  providers: [ListsService],
  exports: [ListsService],
})
export class ListsModule {}
