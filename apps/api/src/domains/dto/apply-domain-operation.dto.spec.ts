import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ApplyDomainOperationDto } from "./apply-domain-operation.dto";
import assert from "node:assert/strict";
import test from "node:test";

test("ApplyDomainOperationDto defaults scope to 'all' when omitted", async () => {
  const raw = {
    domain: "ads.example.com",
    comment: "Added from YAPD Inspector",
  };

  const dto = plainToInstance(ApplyDomainOperationDto, raw);
  const errors = await validate(dto);

  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
  assert.equal(dto.scope, "all");
});

test("ApplyDomainOperationDto accepts explicit scope and patternMode", async () => {
  const raw = {
    domain: "example.org",
    scope: "instance",
    instanceId: "inst-123",
    patternMode: "regex_specific",
    groups: [0, 1],
  };

  const dto = plainToInstance(ApplyDomainOperationDto, raw);
  const errors = await validate(dto);

  assert.equal(errors.length, 0);
  assert.equal(dto.scope, "instance");
  assert.equal(dto.instanceId, "inst-123");
  assert.equal(dto.patternMode, "regex_specific");
});

test("ApplyDomainOperationDto rejects invalid scope with clear message", async () => {
  const raw = {
    domain: "example.com",
    scope: "invalid-scope",
  };

  const dto = plainToInstance(ApplyDomainOperationDto, raw);
  const errors = await validate(dto);

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.property, "scope");
  assert.ok(
    errors[0]?.constraints?.isIn?.includes("scope must be one of the following values: all, instance"),
    `Unexpected constraint message: ${JSON.stringify(errors[0]?.constraints)}`,
  );
});

test("ApplyDomainOperationDto rejects invalid patternMode with clear message", async () => {
  const raw = {
    domain: "example.com",
    patternMode: "invalid-mode",
  };

  const dto = plainToInstance(ApplyDomainOperationDto, raw);
  const errors = await validate(dto);

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.property, "patternMode");
  assert.ok(
    errors[0]?.constraints?.isIn?.includes("patternMode must be one of the following values: exact, wildcard, regex"),
    `Unexpected constraint message: ${JSON.stringify(errors[0]?.constraints)}`,
  );
});
