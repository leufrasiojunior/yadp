import { Global, Module } from "@nestjs/common";

import { AppConfigEventsService } from "./app-config-events.service";

@Global()
@Module({
  providers: [AppConfigEventsService],
  exports: [AppConfigEventsService],
})
export class AppConfigEventsModule {}
