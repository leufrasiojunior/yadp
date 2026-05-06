import "reflect-metadata";

import "./config/load-env";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { REQUEST_ID_HEADER, setRequestId } from "./common/http/request-context";
import { getRequestLocale } from "./common/i18n/locale";
import { normalizeAppLogLevel, resolveNestLoggerLevels } from "./common/logging/log-levels";
import { AppEnvService } from "./config/app-env";
import { buildOpenApiDocument } from "./openapi";
import { randomUUID } from "node:crypto";

async function bootstrap() {
  const configuredLogLevel = normalizeAppLogLevel(process.env.LOG_LEVEL);
  const app = await NestFactory.create(AppModule, {
    logger: resolveNestLoggerLevels(configuredLogLevel),
  });
  const env = app.get(AppEnvService);
  const logger = new Logger("Bootstrap");
  const corsOrigins =
    env.values.WEB_ORIGIN.trim() === "*"
      ? true
      : env.values.WEB_ORIGIN.split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0);

  app.enableShutdownHooks();
  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.use(helmet());
  app.use((request: Request, response: Response, next: NextFunction) => {
    const incomingRequestId = request.header(REQUEST_ID_HEADER)?.trim();
    const requestId = incomingRequestId && incomingRequestId.length > 0 ? incomingRequestId : randomUUID();

    setRequestId(request, requestId);
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  });
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.setHeader("content-language", getRequestLocale(request));
    next();
  });
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (env.values.SWAGGER_ENABLED) {
    SwaggerModule.setup("api/docs", app, buildOpenApiDocument(app));
  }

  await app.listen(env.values.API_PORT, env.values.API_HOST);
  logger.log(
    `YAPD API listening on http://${env.values.API_HOST}:${env.values.API_PORT}/api with log level "${env.values.LOG_LEVEL}".`,
  );
}

void bootstrap();
