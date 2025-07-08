// src/app/api/piholes/auth/route.ts

import { NextRequest, NextResponse } from "next/server";
import https from "https";
import axios from "axios";

// Agente que ignora validação de certificado
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export async function POST(req: NextRequest) {
  const { url, password } = await req.json();

  try {
    // Garante que não haja "/" extra no fim da URL
    const endpoint = `${url.replace(/\/$/, "")}/api/auth`;
    const { data } = await axios.post(
      new URL(endpoint),
      { password },
      {
        httpsAgent,
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      }
    );

    // Extrai só o que interessa
    const { sid, csrf } = data.session;
    return NextResponse.json({ sid, csrf });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha na autenticação";
    console.error("Auth error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
