import type { LogLevel } from "@nestjs/common";

export const LOG_LEVEL_VALUES = ["error", "warn", "log", "debug", "verbose"] as const;

export type AppLogLevel = (typeof LOG_LEVEL_VALUES)[number];

export const DEFAULT_APP_LOG_LEVEL: AppLogLevel = "log";

export function normalizeAppLogLevel(value: string | undefined | null): AppLogLevel {
  if (value && LOG_LEVEL_VALUES.includes(value as AppLogLevel)) {
    return value as AppLogLevel;
  }

  return DEFAULT_APP_LOG_LEVEL;
}

export function resolveNestLoggerLevels(level: AppLogLevel): LogLevel[] {
  const enabledUntil = LOG_LEVEL_VALUES.indexOf(level);

  if (enabledUntil < 0) {
    return [...LOG_LEVEL_VALUES];
  }

  return LOG_LEVEL_VALUES.slice(0, enabledUntil + 1) as LogLevel[];
}
