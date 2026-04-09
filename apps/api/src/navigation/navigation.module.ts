import { Module } from "@nestjs/common";

import { DomainsModule } from "../domains/domains.module";
import { GroupsModule } from "../groups/groups.module";
import { ListsModule } from "../lists/lists.module";
import { SessionModule } from "../session/session.module";
import { NavigationController } from "./navigation.controller";
import { NavigationService } from "./navigation.service";

@Module({
  imports: [DomainsModule, GroupsModule, ListsModule, SessionModule],
  controllers: [NavigationController],
  providers: [NavigationService],
})
export class NavigationModule {}
