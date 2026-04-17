import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { findTutorById, findTutorByUserId } from "../repositories/tutorRepo.js";
import {
  createBooking,
  findBookingById,
  hasTutorTimeConflict,
  listBookingsByStudentId,
  listBookingsByTutorId,
} from "../repositories/bookingRepo.js";
import { findSlotById } from "../repositories/slotRepo.js";
import { findUserById } from "../repositories/userRepo.js";

export const bookingsRouter = express.Router();

function tutorDisplayName(tutorId) {
  const tutor = findTutorById(tutorId);
  if (!tutor) return "Tutor";
  const u = findUserById(tutor.userId);
  return u?.fullName || "Tutor";
}

function enrichForStudent(booking) {
  return {
    ...booking,
    tutorName: tutorDisplayName(booking.tutorId),
  };
}

function enrichForTutor(booking) {
  return { ...booking };
}

bookingsRouter.post("/", requireAuth, requireRole("student"), (req, res) => {
  const { tutorId, slotId, subject, startAt, durationMinutes } = req.body ?? {};

  if (!tutorId || typeof tutorId !== "string") {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "tutorId is required" });
  }

  const tutor = findTutorById(tutorId);
  if (!tutor || tutor.verificationStatus !== "approved") {
    return res.status(404).json({ error: "NOT_FOUND", message: "Tutor not found" });
  }

  let startIso;
  let dur;

  if (slotId) {
    if (typeof slotId !== "string") {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "slotId must be a string" });
    }
    const slot = findSlotById(slotId);
    if (!slot || slot.tutorId !== tutorId) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Invalid slot for this tutor" });
    }
    startIso = slot.startAt;
    dur = slot.durationMinutes;
  } else {
    if (!startAt || typeof startAt !== "string") {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "startAt is required when slotId is omitted" });
    }
    const parsed = new Date(startAt);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "startAt must be a valid ISO date" });
    }
    dur = Math.max(15, Number(durationMinutes) || 60);
    startIso = parsed.toISOString();
  }

  if (hasTutorTimeConflict(tutor.id, startIso, dur)) {
    return res.status(409).json({
      error: "SLOT_TAKEN",
      message: "That time is no longer available. Please choose another slot.",
    });
  }

  const subj = typeof subject === "string" ? subject.trim() : "";
  const booking = createBooking({
    tutorId: tutor.id,
    studentId: req.user.id,
    studentName: req.user.fullName,
    subject: subj,
    startAt: startIso,
    durationMinutes: dur,
    status: "pending",
    slotId: slotId || null,
  });

  return res.status(201).json({ booking: enrichForStudent(booking) });
});

function parseBookingsListQuery(req) {
  const u = String(req.query.upcoming ?? "").toLowerCase();
  const p = String(req.query.past ?? "").toLowerCase();
  const upcomingOnly = u === "1" || u === "true";
  const pastOnly = p === "1" || p === "true";
  return { upcomingOnly, pastOnly };
}

bookingsRouter.get("/me", requireAuth, (req, res) => {
  const { upcomingOnly, pastOnly } = parseBookingsListQuery(req);
  if (upcomingOnly && pastOnly) {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "Use only one of upcoming or past" });
  }

  if (req.user.role === "student") {
    const bookings = listBookingsByStudentId(req.user.id, { upcomingOnly, pastOnly });
    return res.json({ bookings: bookings.map(enrichForStudent) });
  }
  if (req.user.role === "tutor") {
    const tutor = findTutorByUserId(req.user.id);
    if (!tutor) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Tutor profile not found" });
    }
    const bookings = listBookingsByTutorId(tutor.id, { upcomingOnly, pastOnly });
    return res.json({ bookings: bookings.map(enrichForTutor) });
  }
  return res.status(403).json({ error: "FORBIDDEN", message: "Bookings list is only available for students and tutors" });
});

bookingsRouter.get("/:id", requireAuth, (req, res) => {
  const booking = findBookingById(req.params.id);
  if (!booking) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Booking not found" });
  }
  const tutor = findTutorByUserId(req.user.id);
  const isTutorOwner = tutor && booking.tutorId === tutor.id;
  const isStudentOwner = req.user.role === "student" && booking.studentId === req.user.id;
  if (!isTutorOwner && !isStudentOwner) {
    return res.status(403).json({ error: "FORBIDDEN", message: "Cannot access this booking" });
  }
  const payload = req.user.role === "student" ? enrichForStudent(booking) : enrichForTutor(booking);
  return res.json({ booking: payload });
});
