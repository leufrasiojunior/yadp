import { Module } from "@nestjs/common";

import { SessionModule } from "../session/session.module";
import { ToursController } from "./tours.controller";
import { ToursService } from "./tours.service";

@Module({
  imports: [SessionModule],
  controllers: [ToursController],
  providers: [ToursService],
})
export class ToursModule {}
