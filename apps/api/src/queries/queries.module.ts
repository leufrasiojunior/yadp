import { Module } from "@nestjs/common";

import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { QueriesController } from "./queries.controller";
import { QueriesService } from "./queries.service";
import { QueryGroupMembershipsService } from "./query-group-memberships.service";

@Module({
  imports: [PiholeModule, SessionModule],
  controllers: [QueriesController],
  providers: [QueriesService, QueryGroupMembershipsService],
})
export class QueriesModule {}
