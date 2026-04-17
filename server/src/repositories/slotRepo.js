import crypto from "crypto";

const slotsById = new Map();
const slotsByTutorId = new Map();

export function createSlot({ tutorId, startAt, durationMinutes = 60 }) {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) {
    const err = new Error("Invalid startAt");
    err.code = "INVALID_DATE";
    throw err;
  }
  const dur = Math.max(15, Number(durationMinutes) || 60);
  const slot = {
    id: crypto.randomUUID(),
    tutorId,
    startAt: start.toISOString(),
    durationMinutes: dur,
    createdAt: new Date().toISOString(),
  };
  slotsById.set(slot.id, slot);
  if (!slotsByTutorId.has(tutorId)) slotsByTutorId.set(tutorId, []);
  slotsByTutorId.get(tutorId).push(slot);
  return { ...slot };
}

export function findSlotById(id) {
  if (!id) return null;
  const s = slotsById.get(id);
  return s ? { ...s } : null;
}

export function listSlotsByTutorId(tutorId, { from, to } = {}) {
  const list = (slotsByTutorId.get(tutorId) || []).map((s) => ({ ...s }));
  const fromD = from ? new Date(from) : null;
  const toD = to ? new Date(to) : null;
  let filtered = list;
  if (fromD && !Number.isNaN(fromD.getTime())) {
    filtered = filtered.filter((s) => new Date(s.startAt) >= fromD);
  }
  if (toD && !Number.isNaN(toD.getTime())) {
    const toEnd = new Date(toD);
    toEnd.setHours(23, 59, 59, 999);
    filtered = filtered.filter((s) => new Date(s.startAt) <= toEnd);
  }
  return filtered.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}
