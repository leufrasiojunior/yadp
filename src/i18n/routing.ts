import { defineRouting } from "next-intl/routing";
import { supportedLocales } from "@/config/locales";

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: supportedLocales,

  // Used when no locale matches
  defaultLocale: "pt-br",
});
