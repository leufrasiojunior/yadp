import { promises as fs } from "fs";
import crypto from "crypto";
import path from "path";

const CONFIG_PATH = "/config/setup.json";
const ALGO = "aes-256-cbc";
const MASTER_KEY = crypto.scryptSync(process.env.CONFIG_SECRET!, "salt", 32);
const IV = Buffer.alloc(16, 0);

async function loadConfig() {
  const raw = await fs.readFile(CONFIG_PATH, "utf8");
  const { piholeUrl, password: encrypted } = JSON.parse(raw);

  const decipher = crypto.createDecipheriv(ALGO, MASTER_KEY, IV);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return { piholeUrl, password: decrypted };
}
