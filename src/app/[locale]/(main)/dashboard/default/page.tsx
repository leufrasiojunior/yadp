import { getTranslations, setRequestLocale } from "next-intl/server";

import { ChartAreaInteractive } from "./_components/chart-area-interactive";
import { ChartClientArea } from "./_components/client-activity";
import { DataTable } from "./_components/data-table";
import data from "./_components/data.json";
import { SectionCards } from "./_components/section-cards";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  // Enable static rendering
  setRequestLocale(locale);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <SectionCards />
      <ChartAreaInteractive />
      <ChartClientArea />
      {/* <DataTable data={data} /> */}
    </div>
  );
}
