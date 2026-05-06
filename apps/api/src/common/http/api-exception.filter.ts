import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

import { getRequestId } from "./request-context";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId = getRequestId(request) ?? "-";
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttpException ? exception.getResponse() : null;
    const message = this.extractMessage(exception, payload);
    const suffix = payload && typeof payload === "object" ? ` payload=${JSON.stringify(payload)}` : "";

    if (status >= 500) {
      this.logger.error(
        `[req:${requestId}] !! ${request.method} ${request.originalUrl} status=${status} message="${message}"${suffix}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[req:${requestId}] !> ${request.method} ${request.originalUrl} status=${status} message="${message}"${suffix}`,
      );
    }

    if (response.headersSent) {
      return;
    }

    if (isHttpException) {
      response.status(status).json(payload);
      return;
    }

    response.status(status).json({
      statusCode: status,
      message: "Internal server error",
    });
  }

  private extractMessage(exception: unknown, payload: unknown) {
    if (typeof payload === "string" && payload.trim().length > 0) {
      return payload;
    }

    if (payload && typeof payload === "object") {
      const message = (payload as { message?: unknown }).message;

      if (typeof message === "string" && message.trim().length > 0) {
        return message;
      }

      if (Array.isArray(message)) {
        return message.map((item) => String(item)).join("; ");
      }
    }

    if (exception instanceof Error && exception.message.trim().length > 0) {
      return exception.message;
    }

    return "Unknown error";
  }
}
