export type AutomaticImportFieldKey = "cronExpression" | "name" | "target";
export type AutomaticImportFieldErrors = Partial<Record<AutomaticImportFieldKey, string>>;

export function getAutomaticImportApiFieldErrors(message: string): AutomaticImportFieldErrors {
  const normalized = message.toLowerCase();

  if (normalized.length === 0) {
    return {};
  }

  const errors: AutomaticImportFieldErrors = {};

  if (normalized.includes("rule name") || normalized.includes("name is required")) {
    errors.name = message;
  }

  if (normalized.includes("cron expression") || normalized.includes("invalid cron")) {
    errors.cronExpression = message;
  }

  if (
    normalized.includes("scope") ||
    normalized.includes("instanceid") ||
    normalized.includes("configured instance") ||
    normalized.includes("instance is no longer available") ||
    normalized.includes("instancia") ||
    normalized.includes("instância")
  ) {
    errors.target = message;
  }

  return errors;
}
