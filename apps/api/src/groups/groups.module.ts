import { Module } from "@nestjs/common";

import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { GroupsController } from "./groups.controller";
import { GroupsService } from "./groups.service";

@Module({
  imports: [PiholeModule, SessionModule],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
