// src/app/api/piholes/route.ts

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// Mesma resolução de pasta e derivação de chave/IV que você usa em /api/config
const CONFIG_DIR = path.resolve(
  process.cwd(),
  process.env.CONFIG_DIR || "config"
);
const CONFIG_PATH = path.join(CONFIG_DIR, "setup.json");
const ALGO = "aes-256-cbc";

// Deriva MASTER_KEY e IV da sua senha-mestra em CONFIG_SECRET
const MASTER_KEY = crypto.scryptSync(process.env.CONFIG_SECRET!, "salt", 32);
const IV = Buffer.alloc(16, 0);

export async function GET() {
  try {
    // 1) Lê o arquivo criptografado
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    const data = JSON.parse(raw);

    // 2) Se não tiver array piholes, devolve vazio
    if (!Array.isArray(data.piholes)) {
      return NextResponse.json({ piholes: [] });
    }

    // 3) Decripta cada senha
    const piholes = data.piholes.map(
      (item: { url: string; password: string }) => {
        const decipher = crypto.createDecipheriv(ALGO, MASTER_KEY, IV);
        let decrypted = decipher.update(item.password, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return { url: item.url, password: decrypted };
      }
    );

    const result: Record<string, unknown> = {
      piholes,
      mainUrl: data.mainUrl,
      usePiholeAuth: data.usePiholeAuth,
    };

    if (!data.usePiholeAuth && data.yapdPassword) {
      const decipher = crypto.createDecipheriv(ALGO, MASTER_KEY, IV);
      let dec = decipher.update(data.yapdPassword, "hex", "utf8");
      dec += decipher.final("utf8");
      result.yapdPassword = dec;
    }

    return NextResponse.json(result);
  } catch {
    // Se der qualquer erro (arquivo não existe, JSON inválido, etc), retorna array vazio
    return NextResponse.json({ piholes: [] });
  }
}
