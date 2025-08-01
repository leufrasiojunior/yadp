import { redirect } from "next/navigation";

export default async function LocalePage({ params }: { params: { locale: string } }) {
  const { locale } = await params;

  const res = await fetch(`${process.env.NEXT_PUBLIC_HOST}/api/config`, { cache: "no-store" });
  const json = await res.json();

  if (json.hasPiholesConfig == false) {
    redirect(`/${locale}/setup`);
  }

  redirect(`/${locale}/login`);
}
