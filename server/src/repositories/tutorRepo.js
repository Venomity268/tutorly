import crypto from "crypto";

const tutorsByUserId = new Map();
const tutorsById = new Map();

export function createTutor({ userId, bio = "", hourlyRate = 0, subjects = [], yearsExperience = 0 }) {
  if (tutorsByUserId.has(userId)) {
    const err = new Error("User already has a tutor profile");
    err.code = "ALREADY_TUTOR";
    throw err;
  }

  const tutor = {
    id: crypto.randomUUID(),
    userId,
    bio: (bio || "").trim(),
    hourlyRate: Number(hourlyRate) || 0,
    subjects: Array.isArray(subjects) ? subjects : [],
    yearsExperience: Number(yearsExperience) || 0,
    verificationStatus: "pending",
    averageRating: 0,
    reviewCount: 0,
    createdAt: new Date().toISOString(),
  };

  tutorsById.set(tutor.id, tutor);
  tutorsByUserId.set(userId, tutor);
  return { ...tutor };
}

export function findTutorByUserId(userId) {
  if (!userId) return null;
  const t = tutorsByUserId.get(userId);
  return t ? { ...t } : null;
}

export function findTutorById(id) {
  if (!id) return null;
  const t = tutorsById.get(id);
  return t ? { ...t } : null;
}

export function listTutors({ approvedOnly = false, verificationStatus } = {}) {
  let list = Array.from(tutorsById.values());
  if (approvedOnly) list = list.filter((t) => t.verificationStatus === "approved");
  if (verificationStatus) list = list.filter((t) => t.verificationStatus === verificationStatus);
  return list.map((t) => ({ ...t }));
}

export function updateTutorVerification(id, status) {
  const tutor = tutorsById.get(id);
  if (!tutor) return null;
  if (!["pending", "approved", "rejected"].includes(status)) return null;
  tutor.verificationStatus = status;
  return { ...tutor };
}

export function updateTutor(id, updates) {
  const tutor = tutorsById.get(id);
  if (!tutor) return null;
  if (updates.bio !== undefined) tutor.bio = String(updates.bio || "").trim();
  if (updates.hourlyRate !== undefined) tutor.hourlyRate = Number(updates.hourlyRate) || 0;
  if (updates.subjects !== undefined) tutor.subjects = Array.isArray(updates.subjects) ? updates.subjects : [];
  if (updates.yearsExperience !== undefined) tutor.yearsExperience = Number(updates.yearsExperience) || 0;
  return { ...tutor };
}
