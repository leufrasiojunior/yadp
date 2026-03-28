import { Injectable } from "@nestjs/common";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().min(1).default("127.0.0.1"),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/yapd?schema=public"),
  SESSION_COOKIE_NAME: z.string().min(1).default("yapd_session"),
  SESSION_SECRET: z.string().min(16).default("replace-this-session-secret"),
  APP_ENCRYPTION_KEY: z.string().min(16).default("replace-this-encryption-key"),
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
