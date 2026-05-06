import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";

import { AuditModule } from "./audit/audit.module";
import { ClientsModule } from "./clients/clients.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { ApiExceptionFilter } from "./common/http/api-exception.filter";
import { ApiLoggingInterceptor } from "./common/http/api-logging.interceptor";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AppEnvModule } from "./config/app-env.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DomainsModule } from "./domains/domains.module";
import { GroupsModule } from "./groups/groups.module";
import { HealthModule } from "./health/health.module";
import { InstancesModule } from "./instances/instances.module";
import { ListsModule } from "./lists/lists.module";
import { NavigationModule } from "./navigation/navigation.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OverviewModule } from "./overview/overview.module";
import { PiholeModule } from "./pihole/pihole.module";
import { PiholeConfigModule } from "./pihole-config/pihole-config.module";
import { QueriesModule } from "./queries/queries.module";
import { SessionModule } from "./session/session.module";
import { SetupModule } from "./setup/setup.module";
import { SyncModule } from "./sync/sync.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AppEnvModule,
    AuditModule,
    ClientsModule,
    CryptoModule,
    DashboardModule,
    DomainsModule,
    GroupsModule,
    HealthModule,
    InstancesModule,
    ListsModule,
    NavigationModule,
    NotificationsModule,
    OverviewModule,
    PiholeModule,
    PiholeConfigModule,
    PrismaModule,
    QueriesModule,
    SessionModule,
    SetupModule,
    SyncModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiLoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ApiExceptionFilter,
    },
  ],
})
export class AppModule {}
