import { Module } from "@nestjs/common";

import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { QueriesController } from "./queries.controller";
import { QueriesService } from "./queries.service";

@Module({
  imports: [PiholeModule, SessionModule],
  controllers: [QueriesController],
  providers: [QueriesService],
})
export class QueriesModule {}
