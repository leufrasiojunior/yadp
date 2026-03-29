import type { AppLoginMode as DbAppLoginMode } from "../prisma/prisma-client";

export const APP_LOGIN_MODES = ["pihole-master", "yapd-password"] as const;
export type AppLoginMode = (typeof APP_LOGIN_MODES)[number];

export const DEFAULT_APP_LOGIN_MODE: AppLoginMode = "pihole-master";

export function toDbLoginMode(mode: AppLoginMode): DbAppLoginMode {
  return mode === "yapd-password" ? "YAPD_PASSWORD" : "PIHOLE_MASTER";
}

export function fromDbLoginMode(mode: DbAppLoginMode | null | undefined): AppLoginMode {
  return mode === "YAPD_PASSWORD" ? "yapd-password" : "pihole-master";
}
