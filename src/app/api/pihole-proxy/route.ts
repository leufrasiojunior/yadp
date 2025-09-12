import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const piholeUrl = searchParams.get("url");
  const piholeEndpoint = searchParams.get("endpoint");
  const sid = request.headers.get("X-FTL-SID");

  if (!piholeUrl || !sid) {
    return NextResponse.json({ error: "Missing url or sid parameter" }, { status: 400 });
  }

  try {
    console.log("URL: ", `/${piholeEndpoint}`);
    const response = await fetch(`${piholeUrl}/api/${piholeEndpoint}`, {
      headers: {
        "X-FTL-SID": sid,
      },
    });
    if (!response.ok) {
      return NextResponse.json(await response.json(), { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying to Pi-hole:", error);
    return NextResponse.json({ error: "Failed to fetch data from Pi-hole" }, { status: 500 });
  }
}
