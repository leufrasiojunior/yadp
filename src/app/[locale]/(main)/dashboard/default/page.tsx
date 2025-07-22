import { getTranslations, setRequestLocale } from "next-intl/server";
import { ChartAreaInteractive } from "./_components/chart-area-interactive";
import { DataTable } from "./_components/data-table";
import data from "./_components/data.json";
import { SectionCards } from "./_components/section-cards";

export default async function Page({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const { locale } = await params;
  
  // Enable static rendering
  setRequestLocale(locale);
  
  const t = await getTranslations("dashboard.cards");

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <SectionCards
        totalRevenue={{
          title: t("totalRevenue.title"),
          trending: t("totalRevenue.trending"),
          description: t("totalRevenue.description")
        }}
        newCustomers={{
          title: t("newCustomers.title"),
          trending: t("newCustomers.trending"),
          description: t("newCustomers.description")
        }}
        activeAccounts={{
          title: t("activeAccounts.title"),
          trending: t("activeAccounts.trending"),
          description: t("activeAccounts.description")
        }}
        growthRate={{
          title: t("growthRate.title"),
          trending: t("growthRate.trending"),
          description: t("growthRate.description")
        }}
      />
      <ChartAreaInteractive />
      <DataTable data={data} />
    </div>
  );
}
