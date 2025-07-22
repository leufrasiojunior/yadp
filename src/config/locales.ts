export interface Language {
  value: string;
  label: string;
  code: string;
}

export const localeLanguages: Language[] = [
  { value: "en", label: "English", code: "US" },
  { value: "pt-br", label: "Português (Brasil)", code: "BR" },
  // Exemplos para futuros idiomas:
  // { value: "es", label: "Español", code: "ES" },
  // { value: "fr", label: "Français", code: "FR" },
  // { value: "de", label: "Deutsch", code: "DE" },
];

// Helper function to get flag emoji from country code
export const getFlagEmoji = (countryCode: string): string => {
  const flagMap: Record<string, string> = {
    US: "🇺🇸",
    BR: "🇧🇷",
    ES: "🇪🇸", 
    FR: "🇫🇷",
    DE: "🇩🇪",
    IT: "🇮🇹",
    JP: "🇯🇵",
    CN: "🇨🇳",
    KR: "🇰🇷",
    // Add more countries as needed
  };
  
  return flagMap[countryCode] || "🌐";
};

// Extract just the locale values for routing
export const supportedLocales = localeLanguages.map(lang => lang.value);

// Helper function to get language info by locale value
export const getLanguageByLocale = (locale: string): Language | undefined => {
  return localeLanguages.find(lang => lang.value === locale);
};

// Helper function to get the default language
export const getDefaultLanguage = (): Language => {
  return localeLanguages.find(lang => lang.value === "pt-br") || localeLanguages[0];
};
