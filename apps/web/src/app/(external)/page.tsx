import { redirect } from "next/navigation";

import { ApiUnavailableScreen } from "@/components/yapd/api-unavailable-screen";
import { getServerSession, getSetupStatus, isYapdApiUnavailableError } from "@/lib/api/yapd-server";

export default async function Home() {
  try {
    const setup = await getSetupStatus();

    if (setup.needsSetup) {
      redirect("/setup");
    }

    const session = await getServerSession();

    if (session) {
      redirect("/dashboard");
    }

    redirect("/login");
  } catch (error) {
    if (isYapdApiUnavailableError(error)) {
      return <ApiUnavailableScreen apiBaseUrl={error.baseUrl} />;
    }

    throw error;
  }
}
