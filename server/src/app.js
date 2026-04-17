import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { tutorsRouter } from "./routes/tutors.js";
import { coursesRouter } from "./routes/courses.js";
import { bookingsRouter } from "./routes/bookings.js";
import { paymentsRouter } from "./routes/payments.js";

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
  app.use("/admin", adminRouter);
  app.use("/tutors", tutorsRouter);
  app.use("/courses", coursesRouter);
  app.use("/bookings", bookingsRouter);
  app.use("/payments", paymentsRouter);

  // Support both direct routes and /api-prefixed routes in production.
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/tutors", tutorsRouter);
  app.use("/api/courses", coursesRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/payments", paymentsRouter);

  app.use((req, res) => {
    res.status(404).json({ error: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.statusCode || err.status || 500;
    if (status >= 500) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
    const body =
      status === 500
        ? { error: "INTERNAL_ERROR", message: "Unexpected server error" }
        : { error: err.code || "ERROR", message: err.message || "Request failed" };
    res.status(status >= 400 && status < 600 ? status : 500).json(body);
  });

  return app;
}

