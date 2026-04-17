import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Minimal .env loader (no dotenv package - works on UNC/network paths). */
function loadEnvFile() {
  const envPath = join(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile();

function required(name) {
  const value = process.env[name];
  if (!value) {
    const envFile = join(__dirname, "..", ".env");
    const hint = existsSync(envFile)
      ? `Open ${envFile} and set ${name}=...`
      : `Copy .env.example to .env in this folder, then set ${name} (example file includes a dev placeholder).`;
    throw new Error(`Missing required environment variable: ${name}. ${hint}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 7503),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "*",
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
};
