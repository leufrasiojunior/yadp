import "reflect-metadata";

import "../config/load-env";

import type { Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type RuntimeModule<T> = {
  default?: T;
  "module.exports"?: T;
} & Partial<T>;

async function main() {
  process.env.SKIP_DB_CONNECT = "true";
  const appModule = (await import("../app.module")) as RuntimeModule<{
    AppModule?: Type<unknown>;
  }>;
  const openApiModule = (await import("../openapi")) as RuntimeModule<{
    buildOpenApiDocument?: (app: Awaited<ReturnType<typeof NestFactory.create>>) => object;
  }>;
  const AppModule = appModule.AppModule ?? appModule.default?.AppModule ?? appModule["module.exports"]?.AppModule;
  const buildOpenApiDocument =
    openApiModule.buildOpenApiDocument ??
    openApiModule.default?.buildOpenApiDocument ??
    openApiModule["module.exports"]?.buildOpenApiDocument;

  if (!AppModule || !buildOpenApiDocument) {
    throw new Error("Could not resolve AppModule for OpenAPI generation.");
  }

  const app = await NestFactory.create(AppModule, {
    logger: false,
  });
  const document = buildOpenApiDocument(app);
  const outputPath = resolve(process.cwd(), "openapi.json");

  await writeFile(outputPath, JSON.stringify(document, null, 2), "utf8");
  await app.close();
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
