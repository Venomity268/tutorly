import { createApp } from "./app.js";
import { config } from "./config.js";
import { seed } from "./seed.js";

const app = createApp();

seed()
  .then(() => {
    app.listen(config.port, () => {
      // eslint-disable-next-line no-console
      console.log(`Tutorly API listening on ${config.port}`);
    });
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", err);
    process.exit(1);
  });

