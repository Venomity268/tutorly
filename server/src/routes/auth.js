import express from "express";
import bcrypt from "bcryptjs";
import { createUser, findUserByEmail, findUserById, updateUser } from "../repositories/userRepo.js";
import { createTutor, findTutorByUserId } from "../repositories/tutorRepo.js";
import { requireAuth } from "../middleware/auth.js";
import { signAccessToken } from "../utils/jwt.js";
import { normalizeSubjectSlugs } from "../utils/subjects.js";

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
  const { fullName, email, password, role, studentSubjects, studentLevel, tutorSubjects } = req.body ?? {};

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

  const subjStu = normalizeSubjectSlugs(studentSubjects);
  const subjTut = normalizeSubjectSlugs(tutorSubjects);
  if (normalizedRole === "student") {
    if (subjStu.length < 1) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Select at least one subject" });
    }
    if (typeof studentLevel !== "string" || !String(studentLevel).trim()) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Education level is required" });
    }
  }
  if (normalizedRole === "tutor" && subjTut.length < 1) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Select at least one subject you teach" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = createUser({
      fullName,
      email,
      passwordHash,
      role: normalizedRole,
      studentSubjects: normalizedRole === "student" ? subjStu : [],
      studentLevel: normalizedRole === "student" ? String(studentLevel).trim() : "",
    });

    if (normalizedRole === "tutor") {
      createTutor({
        userId: user.id,
        bio: "",
        hourlyRate: 0,
        subjects: subjTut,
        yearsExperience: 0,
      });
    }

    const token = signAccessToken({ sub: user.id, role: user.role });
    const { passwordHash: _p, ...safe } = findUserById(user.id) || user;
    return res.status(201).json({
      token,
      user: {
        id: safe.id,
        fullName: safe.fullName,
        email: safe.email,
        role: safe.role,
        studentSubjects: safe.studentSubjects ?? [],
        studentLevel: safe.studentLevel ?? "",
      },
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

  const u = findUserById(user.id) || user;
  const token = signAccessToken({ sub: u.id, role: u.role });
  return res.json({
    token,
    user: {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      tutorVerification: tutorProfile?.verificationStatus ?? null,
      studentSubjects: u.studentSubjects ?? [],
      studentLevel: u.studentLevel ?? "",
    },
  });
});

authRouter.get("/login", (_req, res) => {
  return res
    .status(405)
    .json({ error: "METHOD_NOT_ALLOWED", message: "Use POST /auth/login with email and password" });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const { findTutorByUserId } = await import("../repositories/tutorRepo.js");
  const dbUser = findUserById(req.user.id);
  if (!dbUser) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "User not found" });
  }
  let tutorVerification = null;
  if (req.user.role === "tutor") {
    const t = findTutorByUserId(req.user.id);
    tutorVerification = t?.verificationStatus ?? null;
  }
  const { passwordHash, ...safe } = dbUser;
  return res.json({
    user: { ...safe, tutorVerification },
  });
});

authRouter.patch("/me", requireAuth, (req, res) => {
  const { fullName, studentSubjects, studentLevel } = req.body ?? {};
  const updates = {};
  if (typeof fullName === "string" && fullName.trim().length >= 2) {
    updates.fullName = fullName.trim();
  }
  if (req.user.role === "student") {
    if (studentSubjects !== undefined) {
      const subj = normalizeSubjectSlugs(studentSubjects);
      if (subj.length < 1) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "Select at least one subject" });
      }
      updates.studentSubjects = subj;
    }
    if (studentLevel !== undefined) {
      if (typeof studentLevel !== "string" || !studentLevel.trim()) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "Education level is required" });
      }
      updates.studentLevel = studentLevel.trim();
    }
  } else if (studentSubjects !== undefined || studentLevel !== undefined) {
    return res
      .status(403)
      .json({ error: "FORBIDDEN", message: "Subject preferences are for students; tutors use profile" });
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "No valid fields to update" });
  }
  const updated = updateUser(req.user.id, updates);
  if (!updated) {
    return res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
  }
  const { passwordHash, ...safe } = updated;
  return res.json({ user: safe });
});

