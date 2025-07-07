"use client"

import { useTranslations } from "next-intl"

export default function TopClientsPage() {
  const t = useTranslations("Navigation")
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold">{t("topClients")}</h2>
    </div>
  )
}
