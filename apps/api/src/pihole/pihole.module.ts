import { Module } from "@nestjs/common";

import { PiholeService } from "./pihole.service";
import { PiholeInstanceConnectorService } from "./pihole-instance-connector.service";
import { PiholeInstanceSessionService } from "./pihole-instance-session.service";
import { PiholeWorkCoordinatorService } from "./pihole-work-coordinator.service";

@Module({
  providers: [
    PiholeService,
    PiholeInstanceConnectorService,
    PiholeInstanceSessionService,
    PiholeWorkCoordinatorService,
  ],
  exports: [PiholeService, PiholeInstanceConnectorService, PiholeInstanceSessionService, PiholeWorkCoordinatorService],
})
export class PiholeModule {}
