// src/config/locales.ts

// Define a interface que representa um idioma com valor (locale), nome de exibição e código do país
export interface Language {
  value: string; // Código do locale (ex: "pt-br")
  label: string; // Nome do idioma exibido (ex: "Português (Brasil)")
  code: string; // Código do país associado (ex: "BR")
}

// Lista de idiomas suportados pela aplicação
export const localeLanguages: Language[] = [
  { value: "en", label: "English", code: "US" },
  { value: "pt-br", label: "Português (Brasil)", code: "BR" },
  { value: "es", label: "Español", code: "ES" },
  // Futuras opções comentadas para expansão de idiomas
  // { value: "fr", label: "Français", code: "FR" },
  // { value: "de", label: "Deutsch", code: "DE" },
];

// Mapeamento seguro de códigos de país para emojis de bandeira
// Utiliza `Map` para evitar acessos dinâmicos perigosos (evita warning de segurança)
const flagMap = new Map<string, string>([
  ["US", "🇺🇸"],
  ["BR", "🇧🇷"],
  ["ES", "🇪🇸"],
  ["FR", "🇫🇷"],
  ["DE", "🇩🇪"],
  ["IT", "🇮🇹"],
  ["JP", "🇯🇵"],
  ["CN", "🇨🇳"],
  ["KR", "🇰🇷"],
]);

// Retorna o emoji de bandeira correspondente ao código de país informado
// Se o código não for encontrado no Map, retorna um emoji genérico 🌐
export const getFlagEmoji = (countryCode: string): string => {
  return flagMap.get(countryCode) ?? "🌐";
};

// Extrai apenas os valores de locale (ex: "en", "pt-br") para uso em rotas
export const supportedLocales = localeLanguages.map((lang) => lang.value);

// Busca o objeto Language correspondente a um locale específico
// Útil para recuperar nome do idioma e código do país a partir do locale
export const getLanguageByLocale = (locale: string): Language | undefined => {
  return localeLanguages.find((lang) => lang.value === locale);
};

// Define o idioma padrão da aplicação
// Prioriza o português do Brasil, e usa o primeiro da lista como fallback
export const getDefaultLanguage = (): Language => {
  return localeLanguages.find((lang) => lang.value === "pt-br") ?? localeLanguages[0];
};
