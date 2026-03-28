import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function buildOpenApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle("YAPD API")
    .setDescription("API do primeiro slice do YAPD")
    .setVersion("0.1.0")
    .addCookieAuth("yapd_session", {
      type: "apiKey",
      in: "cookie",
      name: "yapd_session",
    })
    .build();

  return SwaggerModule.createDocument(app, config);
}
