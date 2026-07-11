import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { CryptoModule } from "../common/crypto/crypto.module";
import { PrismaModule } from "../common/prisma/prisma.module";
import { DomainsModule } from "../domains/domains.module";
import { SessionModule } from "../session/session.module";
import { BrowserExtensionController } from "./browser-extension.controller";
import { BrowserExtensionService } from "./browser-extension.service";
import { BrowserExtensionAuthGuard } from "./browser-extension-auth.guard";

@Module({
  imports: [AuditModule, CryptoModule, DomainsModule, PrismaModule, SessionModule],
  controllers: [BrowserExtensionController],
  providers: [BrowserExtensionAuthGuard, BrowserExtensionService],
})
export class BrowserExtensionModule {}
