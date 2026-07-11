import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { AuditModule } from "./audit/audit.module";
import { BrowserExtensionModule } from "./browser-extension/browser-extension.module";
import { ClientsModule } from "./clients/clients.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { ApiExceptionFilter } from "./common/http/api-exception.filter";
import { ApiLoggingInterceptor } from "./common/http/api-logging.interceptor";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AppEnvService } from "./config/app-env";
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
import { ToursModule } from "./tours/tours.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AppEnvModule,
    ThrottlerModule.forRootAsync({
      inject: [AppEnvService],
      useFactory: (env: AppEnvService) => ({
        throttlers: [
          {
            name: "default",
            ttl: env.values.THROTTLER_TTL_MS,
            limit: env.values.THROTTLER_LIMIT,
          },
        ],
      }),
    }),
    AuditModule,
    BrowserExtensionModule,
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
    ToursModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
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
