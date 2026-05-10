import { PRODUCT_TOUR_BROWSER_COOKIE_NAME } from "./tours.constants";
import { ToursService } from "./tours.service";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

type ProductTourCompletionRecord = {
  id: string;
  browserIdHash: string;
  tourKey: string;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function hashBrowserId(browserId: string) {
  return createHash("sha256").update(browserId).digest("hex");
}

function makeCompletion(overrides: Partial<ProductTourCompletionRecord> = {}): ProductTourCompletionRecord {
  const now = new Date("2026-05-07T16:00:00.000Z");

  return {
    id: overrides.id ?? "completion-1",
    browserIdHash: overrides.browserIdHash ?? hashBrowserId("browser-1"),
    tourKey: overrides.tourKey ?? "overview-v1",
    completedAt: overrides.completedAt ?? now,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function createPrismaStub(initialCompletion: ProductTourCompletionRecord | null = null) {
  const state = {
    completion: initialCompletion ? structuredClone(initialCompletion) : null,
    findUniqueCalls: 0,
    upsertCreateData: null as { browserIdHash: string; tourKey: string } | null,
    upsertUpdateData: null as Record<string, unknown> | null,
  };

  return {
    state,
    productTourCompletion: {
      findUnique: async ({
        where,
      }: {
        where: {
          browserIdHash_tourKey: {
            browserIdHash: string;
            tourKey: string;
          };
        };
      }) => {
        state.findUniqueCalls += 1;
        const completion = state.completion;

        if (
          completion &&
          completion.browserIdHash === where.browserIdHash_tourKey.browserIdHash &&
          completion.tourKey === where.browserIdHash_tourKey.tourKey
        ) {
          return structuredClone(completion);
        }

        return null;
      },
      upsert: async ({
        create,
        update,
      }: {
        create: { browserIdHash: string; tourKey: string };
        update: Record<string, unknown>;
      }) => {
        state.upsertCreateData = create;
        state.upsertUpdateData = update;

        if (state.completion) {
          return structuredClone(state.completion);
        }

        state.completion = makeCompletion({
          id: "completion-created",
          browserIdHash: create.browserIdHash,
          tourKey: create.tourKey,
          completedAt: new Date("2026-05-07T16:10:00.000Z"),
          createdAt: new Date("2026-05-07T16:10:00.000Z"),
          updatedAt: new Date("2026-05-07T16:10:00.000Z"),
        });

        return structuredClone(state.completion);
      },
    },
  };
}

function createResponseStub() {
  const state = {
    cookies: [] as Array<{
      name: string;
      value: string;
      options: {
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: string;
        expires?: Date;
        path?: string;
      };
    }>,
  };

  return {
    state,
    response: {
      cookie: (name: string, value: string, options: (typeof state.cookies)[number]["options"]) => {
        state.cookies.push({ name, value, options });
      },
    },
  };
}

function createService(initialCompletion: ProductTourCompletionRecord | null = null) {
  const prisma = createPrismaStub(initialCompletion);
  const service = new ToursService(
    prisma as never,
    {
      values: {
        COOKIE_SECURE: false,
      },
    } as never,
  );

  return { service, prisma };
}

test("getStatus returns incomplete without a browser cookie", async () => {
  const { service, prisma } = createService();

  const result = await service.getStatus("overview-v1", {
    cookies: {},
  } as never);

  assert.deepEqual(result, {
    tourKey: "overview-v1",
    completed: false,
    completedAt: null,
  });
  assert.equal(prisma.state.findUniqueCalls, 0);
});

test("complete creates an anonymous browser cookie and stores only its hash", async () => {
  const { service, prisma } = createService();
  const { response, state } = createResponseStub();

  const result = await service.complete(
    "overview-v1",
    {
      cookies: {},
    } as never,
    response as never,
  );

  assert.equal(result.completed, true);
  assert.equal(result.completedAt, "2026-05-07T16:10:00.000Z");
  assert.equal(state.cookies.length, 1);
  assert.equal(state.cookies[0].name, PRODUCT_TOUR_BROWSER_COOKIE_NAME);
  assert.equal(state.cookies[0].options.httpOnly, true);
  assert.equal(state.cookies[0].options.secure, false);
  assert.equal(state.cookies[0].options.sameSite, "strict");
  assert.equal(state.cookies[0].options.path, "/");
  assert.ok(state.cookies[0].options.expires instanceof Date);
  assert.notEqual(prisma.state.upsertCreateData?.browserIdHash, state.cookies[0].value);
  assert.equal(prisma.state.upsertCreateData?.browserIdHash, hashBrowserId(state.cookies[0].value));
  assert.equal(prisma.state.upsertCreateData?.tourKey, "overview-v1");
});

test("complete is idempotent for the same browser and tour key", async () => {
  const existingCompletion = makeCompletion({
    browserIdHash: hashBrowserId("browser-1"),
    completedAt: new Date("2026-05-07T16:05:00.000Z"),
  });
  const { service, prisma } = createService(existingCompletion);
  const { response, state } = createResponseStub();

  const result = await service.complete(
    "overview-v1",
    {
      cookies: {
        [PRODUCT_TOUR_BROWSER_COOKIE_NAME]: "browser-1",
      },
    } as never,
    response as never,
  );

  assert.deepEqual(result, {
    tourKey: "overview-v1",
    completed: true,
    completedAt: "2026-05-07T16:05:00.000Z",
  });
  assert.equal(state.cookies.length, 0);
  assert.deepEqual(prisma.state.upsertUpdateData, {});
});

test("unknown tour keys are rejected", async () => {
  const { service } = createService();

  await assert.rejects(
    () =>
      service.getStatus("unknown-tour", {
        cookies: {},
      } as never),
    /Unknown product tour/,
  );
});
