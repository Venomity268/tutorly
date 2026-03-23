import express from "express";
import bcrypt from "bcryptjs";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  listUsers,
  findUserById,
  updatePassword,
} from "../repositories/userRepo.js";
import {
  listTutors,
  findTutorById,
  findTutorByUserId,
  updateTutorVerification,
} from "../repositories/tutorRepo.js";
import {
  listCourses,
  createCourse,
  findCourseById,
  updateCourse,
  deleteCourse,
} from "../repositories/courseRepo.js";
import { findUserByEmail } from "../repositories/userRepo.js";

export const adminRouter = express.Router();

const adminOnly = [requireAuth, requireRole("admin")];

adminRouter.get("/stats", adminOnly, (req, res) => {
  const users = listUsers();
  const tutors = listTutors();
  const courses = listCourses();
  const pendingTutors = tutors.filter((t) => t.verificationStatus === "pending");

  return res.json({
    totalUsers: users.length,
    totalTutors: tutors.length,
    pendingTutors: pendingTutors.length,
    totalCourses: courses.length,
  });
});

adminRouter.get("/users", adminOnly, (req, res) => {
  const users = listUsers();
  return res.json({ users });
});

function enrichTutorForAdmin(t) {
  const user = findUserById(t.userId);
  return user
    ? { ...t, fullName: user.fullName, email: user.email }
    : { ...t, fullName: "Unknown", email: "" };
}

adminRouter.get("/tutors", adminOnly, (req, res) => {
  const status = req.query.status;
  let tutors = listTutors();
  if (status) {
    tutors = tutors.filter((t) => t.verificationStatus === status);
  }
  const enriched = tutors.map(enrichTutorForAdmin);
  return res.json({ tutors: enriched });
});

adminRouter.patch("/tutors/:id/approve", adminOnly, (req, res) => {
  const tutor = updateTutorVerification(req.params.id, "approved");
  if (!tutor) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Tutor not found" });
  }
  return res.json({ tutor });
});

adminRouter.patch("/tutors/:id/reject", adminOnly, (req, res) => {
  const tutor = updateTutorVerification(req.params.id, "rejected");
  if (!tutor) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Tutor not found" });
  }
  return res.json({ tutor });
});

adminRouter.post("/users/reset-password", adminOnly, async (req, res) => {
  const { userId, newPassword } = req.body ?? {};
  if (!userId || typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "userId and newPassword (min 8 chars) required",
    });
  }

  const user = findUserById(userId);
  if (!user) {
    return res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  updatePassword(userId, passwordHash);
  return res.json({ message: "Password updated" });
});

adminRouter.post("/users/reset-password-by-email", adminOnly, async (req, res) => {
  const { email, newPassword } = req.body ?? {};
  if (!email || typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "email and newPassword (min 8 chars) required",
    });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: "NOT_FOUND", message: "User not found" });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  updatePassword(user.id, passwordHash);
  return res.json({ message: "Password updated" });
});

adminRouter.get("/courses", adminOnly, (req, res) => {
  const courses = listCourses();
  return res.json({ courses });
});

adminRouter.post("/courses", adminOnly, (req, res) => {
  const { name, slug, description } = req.body ?? {};
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "name required" });
  }

  try {
    const course = createCourse({ name: name.trim(), slug: slug?.trim(), description: description?.trim() });
    return res.status(201).json({ course });
  } catch (err) {
    if (err?.code === "SLUG_EXISTS") {
      return res.status(409).json({ error: "SLUG_EXISTS", message: "Course slug already exists" });
    }
    return res.status(500).json({ error: "INTERNAL_ERROR", message: "Failed to create course" });
  }
});

adminRouter.patch("/courses/:id", adminOnly, (req, res) => {
  const course = findCourseById(req.params.id);
  if (!course) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Course not found" });
  }

  const { name, slug, description, active } = req.body ?? {};
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (slug !== undefined) updates.slug = slug;
  if (description !== undefined) updates.description = description;
  if (active !== undefined) updates.active = active;

  const updated = updateCourse(req.params.id, updates);
  return res.json({ course: updated });
});

adminRouter.delete("/courses/:id", adminOnly, (req, res) => {
  const ok = deleteCourse(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Course not found" });
  }
  return res.json({ message: "Course deleted" });
});
