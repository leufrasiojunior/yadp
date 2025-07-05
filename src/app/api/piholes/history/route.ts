// // src/app/api/piholes/history/route.ts

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
    // Chama diretamente o endpoint do Pi-hole
    const response = await axios.get(
      `${urlParam.replace(/\/+$/, "")}/api/history`,
      {
        headers: { "X-FTL-SID": sid },
        httpsAgent,
        timeout: 5000,
      }
    );

    // Retorna apenas o array 'history'
    return NextResponse.json({ history: response.data.history });
  } catch (err: any) {
    console.error("Erro ao buscar histórico:", err.message);
    return NextResponse.json(
      { error: err.message || "Erro desconhecido" },
      { status: err.response?.status || 500 }
    );
  }
}
