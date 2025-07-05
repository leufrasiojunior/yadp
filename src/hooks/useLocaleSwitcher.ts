// src/hooks/useLocaleSwitcher.ts
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { languages } from "@/i18n/i18n";

export function useLocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams() as { locale?: string };
  const currentLocale = params.locale ?? languages[0].value;

  // mantém um state “reactivo” que vai atualizar quando a rota mudar
  const [value, setValue] = useState(currentLocale);
  useEffect(() => {
    setValue(currentLocale);
  }, [currentLocale]);

  const changeLocale = (newLocale: string) => {
    if (newLocale === currentLocale) return;
    const newPath = pathname.replace(
      new RegExp(`^/(${languages.map((l) => l.value).join("|")})`),
      `/${newLocale}`
    );
    router.push(newPath);
  };

  return { languages, value, changeLocale };
}
