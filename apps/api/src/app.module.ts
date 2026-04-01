import { Module } from "@nestjs/common";

import { AuditModule } from "./audit/audit.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AppEnvModule } from "./config/app-env.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { DomainsModule } from "./domains/domains.module";
import { HealthModule } from "./health/health.module";
import { InstancesModule } from "./instances/instances.module";
import { PiholeModule } from "./pihole/pihole.module";
import { QueriesModule } from "./queries/queries.module";
import { SessionModule } from "./session/session.module";
import { SetupModule } from "./setup/setup.module";
import { SyncModule } from "./sync/sync.module";

@Module({
  imports: [
    AppEnvModule,
    AuditModule,
    CryptoModule,
    DashboardModule,
    DomainsModule,
    HealthModule,
    InstancesModule,
    PiholeModule,
    PrismaModule,
    QueriesModule,
    SessionModule,
    SetupModule,
    SyncModule,
  ],
})
export class AppModule {}
