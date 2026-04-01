import { Module } from "@nestjs/common";

import { PiholeModule } from "../pihole/pihole.module";
import { SessionModule } from "../session/session.module";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";

@Module({
  imports: [PiholeModule, SessionModule],
  controllers: [DomainsController],
  providers: [DomainsService],
})
export class DomainsModule {}
