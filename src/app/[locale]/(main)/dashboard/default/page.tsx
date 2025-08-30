import { getTranslations, setRequestLocale } from "next-intl/server";

import { ChartAreaInteractive } from "./_components/chart-area-interactive";
import { ChartPieSimple } from "./_components/chart-pie-simple";
import { ChartClientArea } from "./_components/client-activity";
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <ChartPieSimple />
        <ChartPieSimple />
      </div>
    </div>
  );
}
