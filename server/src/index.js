import { createApp } from "./app.js";
import { config } from "./config.js";
import { seed } from "./seed.js";

const app = createApp();

function apiPublicBaseUrl() {
  try {
    const url = new URL(config.projectUrl);
    const isDefaultPort =
      (url.protocol === "https:" && String(config.port) === "443") ||
      (url.protocol === "http:" && String(config.port) === "80");
    const port = isDefaultPort ? "" : `:${config.port}`;
    return `${url.protocol}//${url.hostname}${port}`;
  } catch {
    return `${config.projectUrl}:${config.port}`;
  }
}

seed()
  .then(() => {
    app.listen(config.port, () => {
      // eslint-disable-next-line no-console
      console.log(`Tutorly API listening on ${apiPublicBaseUrl()}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", err);
    process.exit(1);
  });

