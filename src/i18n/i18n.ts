export interface Language {
  value: string;
  label: string;
  code: string;
}

export const languages: Language[] = [
  { value: "en", label: "English", code: "US" },
  { value: "pt-br", label: "Português (Brasil)", code: "BR" },
];
