import { config } from "dotenv";

import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH_CANDIDATES = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "apps/api/.env")];

for (const envPath of ENV_PATH_CANDIDATES) {
  if (!existsSync(envPath)) {
    continue;
  }

  config({
    path: envPath,
    override: false,
    quiet: true,
  });
  break;
}
