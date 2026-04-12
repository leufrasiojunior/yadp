import { Inject, Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../common/prisma/prisma.service";
import type { Prisma } from "../common/prisma/prisma-client";
import { NotificationsService } from "../notifications/notifications.service";

export type AuditEntry = {
  action: string;
  actorType: string;
  actorLabel?: string | null;
  ipAddress?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  result: "SUCCESS" | "FAILURE";
  details?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async record(entry: AuditEntry) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorType: entry.actorType,
          actorLabel: entry.actorLabel ?? null,
          ipAddress: entry.ipAddress ?? null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          result: entry.result,
          details: entry.details,
        },
      });

      if (entry.result === "FAILURE") {
        await this.notifications.recordAuditFailure(entry);
      }
    } catch (error) {
      this.logger.error("Failed to persist audit log", error);
    }
  }
}
