import { type CallHandler, type ExecutionContext, Injectable, Logger, type NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Observable } from "rxjs";
import { tap } from "rxjs/operators";

import { getRequestId, getRequestIp } from "./request-context";
import { performance } from "node:perf_hooks";

@Injectable()
export class ApiLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApiLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = performance.now();
    const requestId = getRequestId(request) ?? "-";
    const query = this.stringifyObject(request.query);
    const params = this.stringifyObject(request.params);
    const body = this.stringifyBody(request.body);

    this.logger.debug(
      `[req:${requestId}] --> ${request.method} ${request.originalUrl} ip=${getRequestIp(request) ?? "-"} params=${params} query=${query} body=${body}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.debug(
            `[req:${requestId}] <-- ${request.method} ${request.originalUrl} status=${response.statusCode} durationMs=${Math.round(performance.now() - startedAt)}`,
          );
        },
        error: () => {
          this.logger.debug(
            `[req:${requestId}] xx> ${request.method} ${request.originalUrl} status=${response.statusCode} durationMs=${Math.round(performance.now() - startedAt)}`,
          );
        },
      }),
    );
  }

  private stringifyObject(value: unknown) {
    if (!value || typeof value !== "object") {
      return "{}";
    }

    return JSON.stringify(value);
  }

  private stringifyBody(value: unknown) {
    if (value === undefined) {
      return "<undefined>";
    }

    if (value === null) {
      return "null";
    }

    if (typeof value !== "object") {
      return JSON.stringify(value);
    }

    return JSON.stringify(this.redactSensitiveFields(value));
  }

  private redactSensitiveFields(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactSensitiveFields(item));
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => {
        const normalizedKey = key.toLowerCase();

        if (
          normalizedKey.includes("password") ||
          normalizedKey.includes("secret") ||
          normalizedKey.includes("token") ||
          normalizedKey.includes("sid") ||
          normalizedKey.includes("csrf")
        ) {
          return [key, "<redacted>"];
        }

        return [key, this.redactSensitiveFields(nestedValue)];
      }),
    );
  }
}
