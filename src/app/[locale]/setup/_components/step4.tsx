"use client";

import { useTranslations } from "next-intl";

export default function Step4() {
  const t = useTranslations("Setup");

  return (
    <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
      <h3 className="text-2xl font-semibold">{t("step4_title")}</h3>
      <p className="text-muted-foreground">{t("step4_description")}</p>
      <p>{t("step4_instruction")}</p>
    </div>
  );
}
