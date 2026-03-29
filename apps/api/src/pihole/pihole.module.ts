import { Module } from "@nestjs/common";

import { PiholeService } from "./pihole.service";
import { PiholeInstanceConnectorService } from "./pihole-instance-connector.service";
import { PiholeInstanceSessionService } from "./pihole-instance-session.service";

@Module({
  providers: [PiholeService, PiholeInstanceConnectorService, PiholeInstanceSessionService],
  exports: [PiholeService, PiholeInstanceConnectorService, PiholeInstanceSessionService],
})
export class PiholeModule {}
