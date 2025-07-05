// src/app/api/config/route.ts
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// const CONFIG_DIR = process.env.CONFIG_DIR || "/config";
// const CONFIG_PATH = path.join(CONFIG_DIR, "setup.json");
const CONFIG_DIR = path.resolve(
  process.cwd(),
  process.env.CONFIG_DIR || "config"
);
const CONFIG_PATH = path.join(CONFIG_DIR, "setup.json");
const ALGO = "aes-256-cbc";

// Derive key e IV a partir de uma “senha-mestra” em env var
const MASTER_KEY = crypto.scryptSync(process.env.CONFIG_SECRET!, "salt", 32);
const IV = Buffer.alloc(16, 0); // para produção, gere um IV random e salve junto

export async function POST(req: NextRequest) {
  const { piholeUrl, password } = await req.json();

  // criptografa a senha
  const cipher = crypto.createCipheriv(ALGO, MASTER_KEY, IV);
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");

  // monta o objeto de configuração
  const configObj = {
    piholeUrl,
    password: encrypted,
  };

  // garante que o diretório existe
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  // grava o JSON formatado
  await fs.writeFile(CONFIG_PATH, JSON.stringify(configObj, null, 2), "utf8");

  return NextResponse.json({ ok: true });
}
