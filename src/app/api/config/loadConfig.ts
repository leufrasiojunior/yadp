import { promises as fs } from "fs";
import crypto from "crypto";

const CONFIG_PATH = "/config/setup.json";
const ALGO = "aes-256-cbc";
const MASTER_KEY = crypto.scryptSync(process.env.CONFIG_SECRET!, "salt", 32);
const IV = Buffer.alloc(16, 0);

export default async function loadConfig() {
  const raw = await fs.readFile(CONFIG_PATH, "utf8");
  const { piholes } = JSON.parse(raw);

  const decrypted = piholes.map((item: { url: string; password: string }) => {
    const decipher = crypto.createDecipheriv(ALGO, MASTER_KEY, IV);
    let dec = decipher.update(item.password, "hex", "utf8");
    dec += decipher.final("utf8");
    return { url: item.url, password: dec };
  });

  return { piholes: decrypted };
}
