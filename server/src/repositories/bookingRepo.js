import crypto from "crypto";

const bookingsById = new Map();
const bookingsByTutorId = new Map();
const bookingsByStudentId = new Map();

const RESERVED_STATUSES = ["pending", "confirmed"];

/** Bookings that should not appear in “upcoming” lists */
const UPCOMING_EXCLUDED_STATUSES = ["cancelled", "completed"];

function sessionEndMs(b) {
  const start = new Date(b.startAt).getTime();
  if (Number.isNaN(start)) return 0;
  return start + (Number(b.durationMinutes) || 60) * 60000;
}

function sessionEndDate(b) {
  return new Date(sessionEndMs(b));
}

function hasRealizedOutcome(b, now = new Date()) {
  if (!["confirmed", "completed"].includes(b.status)) return false;
  return sessionEndMs(b) <= now.getTime();
}

/** Still on your calendar: session not ended yet (includes in-progress) and status is active */
function isUpcomingBooking(b, now = new Date()) {
  const nowMs = now.getTime();
  if (UPCOMING_EXCLUDED_STATUSES.includes(b.status)) return false;
  return sessionEndMs(b) > nowMs;
}

/** History: session has ended, or completed; cancelled only once the slot is over */
function isPastBooking(b, now = new Date()) {
  const nowMs = now.getTime();
  if (b.status === "completed") return true;
  if (b.status === "cancelled") {
    return sessionEndMs(b) < nowMs;
  }
  return sessionEndMs(b) <= nowMs;
}

function indexByStudent(booking) {
  if (!booking.studentId) return;
  if (!bookingsByStudentId.has(booking.studentId)) bookingsByStudentId.set(booking.studentId, []);
  bookingsByStudentId.get(booking.studentId).push(booking);
}

export function createBooking({
  tutorId,
  studentId,
  studentName,
  subject,
  startAt,
  durationMinutes,
  status = "pending",
  slotId = null,
  meetingLink = null,
  hourlyRateSnapshot = null,
}) {
  const booking = {
    id: crypto.randomUUID(),
    tutorId,
    studentId,
    studentName: studentName || "Student",
    subject: subject || "",
    startAt: new Date(startAt).toISOString(),
    durationMinutes: Number(durationMinutes) || 60,
    status: ["confirmed", "pending", "completed", "cancelled"].includes(status) ? status : "pending",
    slotId: slotId || null,
    meetingLink: meetingLink || null,
    hourlyRateSnapshot: Number.isFinite(Number(hourlyRateSnapshot)) ? Number(hourlyRateSnapshot) : null,
    createdAt: new Date().toISOString(),
  };

  bookingsById.set(booking.id, booking);
  if (!bookingsByTutorId.has(tutorId)) bookingsByTutorId.set(tutorId, []);
  bookingsByTutorId.get(tutorId).push(booking);
  indexByStudent(booking);
  return { ...booking };
}

export function findBookingById(id) {
  if (!id) return null;
  const b = bookingsById.get(id);
  return b ? { ...b } : null;
}

export function updateBooking(id, updates) {
  const b = bookingsById.get(id);
  if (!b) return null;
  if (updates.status !== undefined) {
    b.status = ["confirmed", "pending", "completed", "cancelled"].includes(updates.status) ? updates.status : b.status;
  }
  if (updates.meetingLink !== undefined) b.meetingLink = updates.meetingLink;
  return { ...b };
}

/** Returns true if another pending/confirmed booking overlaps this window for the tutor. */
export function hasTutorTimeConflict(tutorId, startAt, durationMinutes, excludeBookingId) {
  const start = new Date(startAt).getTime();
  const end = start + (Number(durationMinutes) || 60) * 60000;
  const list = bookingsByTutorId.get(tutorId) || [];
  for (const b of list) {
    if (excludeBookingId && b.id === excludeBookingId) continue;
    if (!RESERVED_STATUSES.includes(b.status)) continue;
    const bs = new Date(b.startAt).getTime();
    const be = bs + (Number(b.durationMinutes) || 60) * 60000;
    if (start < be && bs < end) return true;
  }
  return false;
}

export function listBookingsByTutorId(tutorId, { upcomingOnly = false, pastOnly = false, status } = {}) {
  const list = (bookingsByTutorId.get(tutorId) || []).map((b) => ({ ...b }));
  const now = new Date();
  let filtered = list;
  if (upcomingOnly && pastOnly) return [];
  if (upcomingOnly) {
    filtered = list.filter((b) => isUpcomingBooking(b, now));
  } else if (pastOnly) {
    filtered = list.filter((b) => isPastBooking(b, now));
  }
  if (status) {
    filtered = filtered.filter((b) => b.status === status);
  }
  if (pastOnly) {
    return filtered.sort((a, b) => new Date(b.startAt) - new Date(a.startAt));
  }
  return filtered.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

export function listBookingsByStudentId(studentId, { upcomingOnly = false, pastOnly = false } = {}) {
  const list = (bookingsByStudentId.get(studentId) || []).map((b) => ({ ...b }));
  const now = new Date();
  let filtered = list;
  if (upcomingOnly && pastOnly) return [];
  if (upcomingOnly) {
    filtered = list.filter((b) => isUpcomingBooking(b, now));
  } else if (pastOnly) {
    filtered = list.filter((b) => isPastBooking(b, now));
  }
  if (pastOnly) {
    return filtered.sort((a, b) => new Date(b.startAt) - new Date(a.startAt));
  }
  return filtered.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

export function getTutorStats(tutorId, tutorHourlyRate) {
  const all = (bookingsByTutorId.get(tutorId) || []).map((b) => ({ ...b }));
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Realized sessions are those that were paid/confirmed and have already ended.
  const realized = all.filter((b) => hasRealizedOutcome(b, now));
  const realizedThisMonth = realized.filter((b) => {
    const end = sessionEndDate(b);
    return end >= thisMonthStart && end < nextMonthStart;
  });
  const earnings = realizedThisMonth.reduce((sum, b) => {
    const hours = (b.durationMinutes || 60) / 60;
    const effectiveRate = Number.isFinite(Number(b.hourlyRateSnapshot))
      ? Number(b.hourlyRateSnapshot)
      : (tutorHourlyRate || 0);
    return sum + effectiveRate * hours;
  }, 0);

  const upcoming = all.filter((b) => isUpcomingBooking(b, now));
  const totalBookings = all.filter((b) => b.status !== "cancelled").length;
  const bookedCount = all.filter((b) => ["confirmed", "completed"].includes(b.status)).length;
  const bookingRate = totalBookings > 0 ? Math.round((bookedCount / totalBookings) * 100) : 0;

  return {
    earningsThisMonth: Math.round(earnings * 100) / 100,
    upcomingCount: upcoming.length,
    bookingRate,
  };
}
