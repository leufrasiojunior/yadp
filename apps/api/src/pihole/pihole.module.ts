import { Module } from "@nestjs/common";

import { PiholeService } from "./pihole.service";

@Module({
  providers: [PiholeService],
  exports: [PiholeService],
})
export class PiholeModule {}
