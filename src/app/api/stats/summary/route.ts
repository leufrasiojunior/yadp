import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";

// Agente para ignorar certificados self-signed
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const urlParam = searchParams.get("url");
  const sid = req.headers.get("x-ftl-sid");

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
    const response = await axios.get(
      `${urlParam.replace(/\/+$/, "")}/api/stats/summary`,
      {
        headers: { "X-FTL-SID": sid },
        httpsAgent,
        timeout: 5000,
      }
    );

    return NextResponse.json(response.data);
  } catch (err: any) {
    console.error("Erro ao buscar resumo:", err.message);
    return NextResponse.json(
      { error: err.message || "Erro desconhecido" },
      { status: err.response?.status || 500 }
    );
  }
}
