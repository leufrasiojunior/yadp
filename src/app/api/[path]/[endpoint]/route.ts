import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";

// Agente para ignorar certificados self-signed
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string; endpoint: string } }
) {
  const { searchParams } = req.nextUrl;
  const urlParam = searchParams.get("url");
  const sid = req.headers.get("x-ftl-sid");
  const { path, endpoint } = await params;

  if (!urlParam) {
    return NextResponse.json(
      { error: "Parâmetro 'url' é obrigatório" },
      { status: 400 }
    );
  }
  if (!sid) {
    return NextResponse.json(
      { error: "Header 'X-FTL-SID' obrigatório" },
      { status: 401 }
    );
  }

  try {
    const target = `${urlParam.replace(/\/+$/, "")}/api/${path}/${endpoint}`;
    const response = await axios.get(new URL(target), {
      headers: { "X-FTL-SID": sid },
      httpsAgent,
      timeout: 5000,
    });

    return NextResponse.json(response.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    const status =
      typeof err === "object" && err && "response" in err
        ? (err as { response?: { status?: number } }).response?.status ?? 500
        : 500;
    console.error(`Erro ao buscar ${path}/${endpoint}:`, message);
    return NextResponse.json({ error: message }, { status });
  }
}
