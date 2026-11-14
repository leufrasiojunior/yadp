import { Module } from "@nestjs/common";

import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";
import { SubnetsController } from "./subnets.controller";
import { SubnetsService } from "./subnets.service";

@Module({
  imports: [PiholeModule, SessionModule],
  controllers: [ClientsController, SubnetsController],
  providers: [ClientsService, SubnetsService],
})
export class ClientsModule {}
