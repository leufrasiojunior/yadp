import { Module } from "@nestjs/common";

import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";

@Module({
  imports: [PiholeModule, SessionModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
