import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import type { Request } from "express";

import { getRequestLocale } from "../common/i18n/locale";
import { translateApi } from "../common/i18n/messages";
import { PiholeRequestError, PiholeService } from "../pihole/pihole.service";
import type {
  PiholeDomainOperationResult,
  PiholeManagedInstanceSummary,
  PiholeRequestErrorKind,
} from "../pihole/pihole.types";
import { PiholeInstanceSessionService } from "../pihole/pihole-instance-session.service";
import {
  DEFAULT_DOMAIN_OPERATION_COMMENT,
  type DomainOperationResponse,
  type DomainsInstanceFailure,
  type DomainsInstanceSource,
  MAX_DOMAIN_INSTANCE_CONCURRENCY,
} from "./domains.types";
import type { ApplyDomainOperationDto } from "./dto/apply-domain-operation.dto";
import type { DomainOperationParamsDto } from "./dto/domain-operation-params.dto";

type SuccessfulDomainOperation = {
  instance: PiholeManagedInstanceSummary;
  result: PiholeDomainOperationResult;
};

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    @Inject(PiholeInstanceSessionService) private readonly instanceSessions: PiholeInstanceSessionService,
    @Inject(PiholeService) private readonly pihole: PiholeService,
  ) {}

  async applyDomainOperation(
    params: DomainOperationParamsDto,
    body: ApplyDomainOperationDto,
    request: Request,
  ): Promise<DomainOperationResponse> {
    const locale = getRequestLocale(request);
    const normalizedDomain = body.domain.trim().toLowerCase();
    const comment = body.comment ?? DEFAULT_DOMAIN_OPERATION_COMMENT;
    const value = params.kind === "regex" ? this.buildRegexPattern(normalizedDomain) : normalizedDomain;
    const effectiveScope = params.type === "deny" && params.kind === "exact" ? "all" : body.scope;
    const effectiveInstanceId = effectiveScope === "instance" ? body.instanceId : undefined;
    const instances = await this.resolveRequestedInstances(effectiveScope, effectiveInstanceId, locale);
    const settled = await this.mapWithConcurrency(instances, MAX_DOMAIN_INSTANCE_CONCURRENCY, async (instance) => {
      try {
        const result = await this.instanceSessions.withActiveSession(instance.id, locale, ({ connection, session }) =>
          this.pihole.applyDomainOperation(connection, session, {
            type: params.type,
            kind: params.kind,
            value,
            comment,
            groups: [0],
            enabled: true,
          }),
        );

        if (result.processed.errors.length > 0) {
          return {
            status: "rejected" as const,
            instance,
            failure: this.mapProcessedFailure(instance, result, locale),
          };
        }

        return {
          status: "fulfilled" as const,
          instance,
          result,
        };
      } catch (error) {
        return {
          status: "rejected" as const,
          instance,
          failure: this.mapInstanceFailure(instance, error, locale),
        };
      }
    });
    const successfulInstances: SuccessfulDomainOperation[] = [];
    const failedInstances: DomainsInstanceFailure[] = [];

    for (const item of settled) {
      if (item.status === "fulfilled") {
        successfulInstances.push({
          instance: item.instance,
          result: item.result,
        });
      } else {
        failedInstances.push(item.failure);
      }
    }

    return {
      request: {
        type: params.type,
        kind: params.kind,
        domain: normalizedDomain,
        value,
        comment,
        scope: effectiveScope,
        instanceId: effectiveInstanceId ?? null,
      },
      summary: {
        totalInstances: instances.length,
        successfulCount: successfulInstances.length,
        failedCount: failedInstances.length,
      },
      successfulInstances: successfulInstances.map((item) => ({
        instanceId: item.instance.id,
        instanceName: item.instance.name,
        processed: item.result.processed,
        took: item.result.took,
      })),
      failedInstances,
    };
  }

  private async resolveRequestedInstances(
    scope: ApplyDomainOperationDto["scope"],
    instanceId: string | undefined,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (scope === "instance") {
      if (!instanceId) {
        throw new BadRequestException(translateApi(locale, "domains.instanceIdRequired"));
      }

      return [await this.instanceSessions.getInstanceSummary(instanceId, locale)];
    }

    return this.instanceSessions.listInstanceSummaries();
  }

  private buildRegexPattern(domain: string) {
    const escaped = domain.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return `(^|\\.)${escaped}$`;
  }

  private toSourceSummary(instance: PiholeManagedInstanceSummary): DomainsInstanceSource {
    return {
      instanceId: instance.id,
      instanceName: instance.name,
    };
  }

  private mapProcessedFailure(
    instance: PiholeManagedInstanceSummary,
    result: PiholeDomainOperationResult,
    locale: ReturnType<typeof getRequestLocale>,
  ): DomainsInstanceFailure {
    const firstError = result.processed.errors.find(
      (item) => (item.message?.trim().length ?? 0) > 0 || (item.item?.trim().length ?? 0) > 0,
    );
    const message =
      firstError?.message ??
      (firstError?.item
        ? `${firstError.item}`
        : translateApi(locale, "domains.operationRejected", { baseUrl: instance.baseUrl }));

    this.logger.warn(`Domain operation rejected for "${instance.name}" (${instance.id}): ${message}`);

    return {
      ...this.toSourceSummary(instance),
      kind: "pihole_response_error",
      message,
    };
  }

  private mapInstanceFailure(
    instance: PiholeManagedInstanceSummary,
    error: unknown,
    locale: ReturnType<typeof getRequestLocale>,
  ): DomainsInstanceFailure {
    if (error instanceof PiholeRequestError) {
      return {
        ...this.toSourceSummary(instance),
        kind: error.kind,
        message: this.resolveFailureMessage(instance, error, locale),
      };
    }

    return {
      ...this.toSourceSummary(instance),
      kind: "unknown",
      message:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : translateApi(locale, "pihole.unreachable", { baseUrl: instance.baseUrl }),
    };
  }

  private resolveFailureMessage(
    instance: PiholeManagedInstanceSummary,
    error: PiholeRequestError,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    if (error.kind === "invalid_credentials") {
      return translateApi(locale, "pihole.invalidTechnicalCredentials", {
        baseUrl: instance.baseUrl,
      });
    }

    if (error.message.trim().length > 0) {
      return error.message;
    }

    return this.getFailureFallbackMessage(error.kind, instance.baseUrl, locale);
  }

  private getFailureFallbackMessage(
    kind: PiholeRequestErrorKind,
    baseUrl: string,
    locale: ReturnType<typeof getRequestLocale>,
  ) {
    switch (kind) {
      case "timeout":
        return translateApi(locale, "pihole.timeout", { baseUrl });
      case "dns_error":
        return translateApi(locale, "pihole.unresolved", { baseUrl });
      case "connection_refused":
        return translateApi(locale, "pihole.refused", { baseUrl });
      case "tls_error":
        return translateApi(locale, "pihole.tls", { baseUrl });
      case "pihole_response_error":
        return translateApi(locale, "domains.operationRejected", { baseUrl });
      default:
        return translateApi(locale, "pihole.unreachable", { baseUrl });
    }
  }

  private async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    execute: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }

    const results = new Array<R>(items.length);
    let nextIndex = 0;

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await execute(items[index] as T, index);
      }
    });

    await Promise.all(workers);

    return results;
  }
}
