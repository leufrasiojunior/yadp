import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { DEFAULT_APP_LOG_LEVEL, LOG_LEVEL_VALUES } from "../common/logging/log-levels";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(LOG_LEVEL_VALUES).default(DEFAULT_APP_LOG_LEVEL),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().min(1).default("127.0.0.1"),
  WEB_ORIGIN: z.string().min(1).default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/yapd?schema=public"),
  SESSION_COOKIE_NAME: z.string().min(1).default("yapd_session"),
  SESSION_SECRET: z.string().min(16).default("replace-this-session-secret"),
  YAPD_SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 12),
  APP_ENCRYPTION_KEY: z.string().min(16).default("replace-this-encryption-key"),
  PIHOLE_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  PIHOLE_GLOBAL_MAX_CONCURRENCY: z.coerce.number().int().positive().default(4),
  PIHOLE_PER_INSTANCE_MAX_CONCURRENCY: z.coerce.number().int().positive().default(1),
  WEB_PUSH_VAPID_SUBJECT: z.string().min(1).default("mailto:admin@yapd.local"),
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().trim().optional(),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().trim().optional(),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SWAGGER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  SKIP_DB_CONNECT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type AppEnv = z.infer<typeof envSchema>;

@Injectable()
export class AppEnvService {
  readonly values = envSchema.parse(process.env);

  get isProduction() {
    return this.values.NODE_ENV === "production";
  }
}
