import express from "express";
import { listTutors, findTutorById, findTutorByUserId, updateTutor } from "../repositories/tutorRepo.js";
import { findUserById, updateUser } from "../repositories/userRepo.js";
import { listBookingsByTutorId, getTutorStats } from "../repositories/bookingRepo.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const tutorsRouter = express.Router();

function enrichTutor(t) {
  const user = findUserById(t.userId);
  if (!user) return null;
  return {
    id: t.id,
    userId: t.userId,
    fullName: user.fullName,
    email: user.email,
    bio: t.bio,
    hourlyRate: t.hourlyRate,
    subjects: t.subjects,
    yearsExperience: t.yearsExperience,
    verificationStatus: t.verificationStatus,
    averageRating: t.averageRating ?? 0,
    reviewCount: t.reviewCount ?? 0,
  };
}

tutorsRouter.get("/", (req, res) => {
  const subject = req.query.subject;
  let tutors = listTutors({ approvedOnly: true });

  if (subject) {
    const s = String(subject).toLowerCase().trim();
    tutors = tutors.filter((t) =>
      t.subjects.some((sub) => sub.toLowerCase().includes(s))
    );
  }

  const enriched = tutors.map(enrichTutor).filter(Boolean);
  return res.json({ tutors: enriched });
});

tutorsRouter.get("/me", requireAuth, requireRole("tutor"), (req, res) => {
  const tutor = findTutorByUserId(req.user.id);
  if (!tutor) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Tutor profile not found" });
  }
  const enriched = enrichTutor(tutor);
  if (!enriched) return res.status(404).json({ error: "NOT_FOUND", message: "Tutor profile not found" });
  const stats = getTutorStats(tutor.id, tutor.hourlyRate);
  return res.json({ tutor: enriched, stats });
});

tutorsRouter.patch("/me", requireAuth, requireRole("tutor"), (req, res) => {
  const tutor = findTutorByUserId(req.user.id);
  if (!tutor) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Tutor profile not found" });
  }
  const { fullName, bio, hourlyRate, subjects, yearsExperience } = req.body ?? {};
  if (typeof fullName === "string" && fullName.trim().length >= 2) {
    updateUser(req.user.id, { fullName: fullName.trim() });
  }
  const tutorUpdates = {};
  if (bio !== undefined) tutorUpdates.bio = bio;
  if (hourlyRate !== undefined) tutorUpdates.hourlyRate = hourlyRate;
  if (Array.isArray(subjects)) tutorUpdates.subjects = subjects;
  if (yearsExperience !== undefined) tutorUpdates.yearsExperience = yearsExperience;
  if (Object.keys(tutorUpdates).length > 0) {
    updateTutor(tutor.id, tutorUpdates);
  }
  const updated = findTutorByUserId(req.user.id);
  const enriched = enrichTutor(updated);
  return res.json({ tutor: enriched });
});

tutorsRouter.get("/me/bookings", requireAuth, requireRole("tutor"), (req, res) => {
  const tutor = findTutorByUserId(req.user.id);
  if (!tutor) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Tutor profile not found" });
  }
  const upcoming = listBookingsByTutorId(tutor.id, { upcomingOnly: true });
  return res.json({ bookings: upcoming });
});

tutorsRouter.get("/:id", (req, res) => {
  const tutor = findTutorById(req.params.id);
  if (!tutor) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Tutor not found" });
  }
  if (tutor.verificationStatus !== "approved") {
    return res.status(404).json({ error: "NOT_FOUND", message: "Tutor not found" });
  }

  const enriched = enrichTutor(tutor);
  if (!enriched) return res.status(404).json({ error: "NOT_FOUND", message: "Tutor not found" });

  return res.json({ tutor: enriched });
});
