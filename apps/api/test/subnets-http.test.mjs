import "reflect-metadata";

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { Module, UnauthorizedException, ValidationPipe } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const { SubnetsController } = require("../dist/clients/subnets.controller.js");
const { SubnetsService } = require("../dist/clients/subnets.service.js");
const { SessionService } = require("../dist/session/session.service.js");

test("subnet HTTP routes enforce authentication, CSRF, DTO validation and preview/apply separation", async () => {
  const calls = [];
  const service = {
    list: async () => ({ items: [], instances: [], unavailableInstances: [] }),
    preview: async (dto) => {
      calls.push(["preview", dto]);
      return { previewToken: "a".repeat(64) };
    },
    apply: async (dto) => {
      calls.push(["apply", dto]);
      return { status: "success" };
    },
  };
  class TestModule {}
  Module({
    controllers: [SubnetsController],
    providers: [
      { provide: SubnetsService, useValue: service },
      {
        provide: SessionService,
        useValue: {
          requireSession: (request) => {
            if (request.headers.authorization !== "test-session") throw new UnauthorizedException();
            return { antiCsrfToken: "test-csrf" };
          },
        },
      },
    ],
  })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, "127.0.0.1");
  try {
    const base = `${await app.getUrl()}/api/clients/subnets`;
    const headers = { authorization: "test-session", "x-yapd-csrf": "test-csrf", "content-type": "application/json" };
    const dto = { client: "192.0.2.0/24", operation: "save", groups: ["IoT"] };
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers })).status, 200);
    assert.equal(
      (
        await fetch(`${base}/preview`, {
          method: "POST",
          headers: { ...headers, "x-yapd-csrf": "wrong" },
          body: JSON.stringify(dto),
        })
      ).status,
      403,
    );
    for (const invalid of [
      { ...dto, groups: [] },
      { ...dto, groups: [9] },
      { ...dto, targetInstanceIds: [] },
      { ...dto, unexpected: true },
      { ...dto, operation: "oops" },
    ]) {
      assert.equal(
        (await fetch(`${base}/preview`, { method: "POST", headers, body: JSON.stringify(invalid) })).status,
        400,
      );
    }
    assert.equal(calls.length, 0);
    assert.equal((await fetch(`${base}/preview`, { method: "POST", headers, body: JSON.stringify(dto) })).status, 200);
    assert.equal(calls[0][0], "preview");
    assert.equal((await fetch(`${base}/apply`, { method: "POST", headers, body: JSON.stringify(dto) })).status, 400);
    assert.equal(
      (
        await fetch(`${base}/apply`, {
          method: "POST",
          headers,
          body: JSON.stringify({ ...dto, previewToken: "a".repeat(64) }),
        })
      ).status,
      200,
    );
    assert.equal(calls[1][0], "apply");
  } finally {
    await app.close();
  }
});
