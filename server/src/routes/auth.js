import express from "express";
import bcrypt from "bcryptjs";
import { createUser, findUserByEmail } from "../repositories/userRepo.js";
import { createTutor, findTutorByUserId } from "../repositories/tutorRepo.js";
import { requireAuth } from "../middleware/auth.js";
import { signAccessToken } from "../utils/jwt.js";

export const authRouter = express.Router();

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizeRole(role) {
  if (!role) return "student";
  const r = String(role).trim().toLowerCase();
  if (r === "student" || r === "tutor" || r === "admin") return r;
  return null;
}

authRouter.post("/register", async (req, res) => {
  const { fullName, email, password, role } = req.body ?? {};

  const normalizedRole = normalizeRole(role);
  if (typeof fullName !== "string" || fullName.trim().length < 2) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "fullName is required" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "email is invalid" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "password must be at least 8 characters" });
  }
  if (!normalizedRole) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "role must be student or tutor" });
  }
  if (normalizedRole === "admin") {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Admin accounts cannot be created via registration" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser({ fullName, email, passwordHash, role: normalizedRole });

    if (normalizedRole === "tutor") {
      createTutor({
        userId: user.id,
        bio: "",
        hourlyRate: 0,
        subjects: [],
        yearsExperience: 0,
      });
    }

    const token = signAccessToken({ sub: user.id, role: user.role });

    return res.status(201).json({
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    });
  } catch (err) {
    if (err?.code === "EMAIL_IN_USE") {
      return res.status(409).json({ error: "EMAIL_IN_USE", message: "Email already in use" });
    }
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to register" });
  }
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "email is invalid" });
  }
  if (typeof password !== "string" || password.length < 1) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "password is required" });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Invalid email or password" });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Invalid email or password" });
  }

  let tutorProfile = null;
  if (user.role === "tutor") {
    tutorProfile = findTutorByUserId(user.id);
  }

  const token = signAccessToken({ sub: user.id, role: user.role });
  return res.json({
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      tutorVerification: tutorProfile?.verificationStatus ?? null,
    },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const { findTutorByUserId } = await import("../repositories/tutorRepo.js");
  let tutorVerification = null;
  if (req.user.role === "tutor") {
    const t = findTutorByUserId(req.user.id);
    tutorVerification = t?.verificationStatus ?? null;
  }
  return res.json({
    user: { ...req.user, tutorVerification },
  });
});

