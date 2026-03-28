import "reflect-metadata";

import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { AppEnvService } from "./config/app-env";
import { buildOpenApiDocument } from "./openapi";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get(AppEnvService);

  app.enableShutdownHooks();
  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.use(helmet());
  app.enableCors({
    origin: [env.values.WEB_ORIGIN],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (env.values.SWAGGER_ENABLED && !env.isProduction) {
    SwaggerModule.setup("api/docs", app, buildOpenApiDocument(app));
  }

  await app.listen(env.values.API_PORT, env.values.API_HOST);
}

void bootstrap();
