import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: config.clientOrigin === "*" ? true : config.clientOrigin,
      credentials: false,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/auth", authRouter);

  app.use((req, res) => {
    res.status(404).json({ error: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Unexpected server error" });
  });

  return app;
}

