import { type AppLocale, DEFAULT_LOCALE } from "./config";
import { enUSMessages } from "./messages.en-us";
import { ptBRMessages } from "./messages.pt-br";
import type { WebMessages } from "./messages.types";

const messages: Record<AppLocale, WebMessages> = {
  "pt-BR": ptBRMessages,
  "en-US": enUSMessages,
};

export type { WebMessages } from "./messages.types";

export function getWebMessages(locale: AppLocale) {
  return messages[locale] ?? messages[DEFAULT_LOCALE];
}
