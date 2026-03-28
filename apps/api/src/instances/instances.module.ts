import { Module } from "@nestjs/common";

import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { InstancesController } from "./instances.controller";
import { InstancesService } from "./instances.service";

@Module({
  imports: [PiholeModule, SessionModule],
  controllers: [InstancesController],
  providers: [InstancesService],
  exports: [InstancesService],
})
export class InstancesModule {}
