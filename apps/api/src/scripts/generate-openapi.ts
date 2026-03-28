import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "../app.module";
import { buildOpenApiDocument } from "../openapi";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  process.env.SKIP_DB_CONNECT = "true";
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });
  const document = buildOpenApiDocument(app);
  const outputPath = resolve(process.cwd(), "openapi.json");

  await writeFile(outputPath, JSON.stringify(document, null, 2), "utf8");
  await app.close();
}

void main();
