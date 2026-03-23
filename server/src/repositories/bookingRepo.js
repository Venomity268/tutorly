import crypto from "crypto";

const bookingsById = new Map();
const bookingsByTutorId = new Map();

export function createBooking({ tutorId, studentId, studentName, subject, startAt, durationMinutes, status = "confirmed" }) {
  const booking = {
    id: crypto.randomUUID(),
    tutorId,
    studentId,
    studentName: studentName || "Student",
    subject: subject || "",
    startAt: new Date(startAt).toISOString(),
    durationMinutes: Number(durationMinutes) || 60,
    status: ["confirmed", "pending", "completed", "cancelled"].includes(status) ? status : "confirmed",
    createdAt: new Date().toISOString(),
  };

  bookingsById.set(booking.id, booking);
  if (!bookingsByTutorId.has(tutorId)) bookingsByTutorId.set(tutorId, []);
  bookingsByTutorId.get(tutorId).push(booking);
  return { ...booking };
}

export function listBookingsByTutorId(tutorId, { upcomingOnly = false, status } = {}) {
  const list = (bookingsByTutorId.get(tutorId) || []).map((b) => ({ ...b }));
  const now = new Date();
  let filtered = list;
  if (upcomingOnly) {
    filtered = list.filter((b) => new Date(b.startAt) >= now && !["cancelled"].includes(b.status));
  }
  if (status) {
    filtered = filtered.filter((b) => b.status === status);
  }
  return filtered.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

export function getTutorStats(tutorId, tutorHourlyRate) {
  const all = (bookingsByTutorId.get(tutorId) || []).map((b) => ({ ...b }));
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const completed = all.filter((b) => b.status === "completed");
  const completedThisMonth = completed.filter((b) => new Date(b.startAt) >= thisMonthStart);
  const earnings = completedThisMonth.reduce((sum, b) => {
    const hours = (b.durationMinutes || 60) / 60;
    return sum + (tutorHourlyRate || 0) * hours;
  }, 0);

  const upcoming = all.filter((b) => new Date(b.startAt) >= now && !["cancelled"].includes(b.status));
  const totalBookings = all.filter((b) => !["cancelled"].includes(b.status)).length;
  const completedCount = completed.length;
  const bookingRate = totalBookings > 0 ? Math.round((completedCount / totalBookings) * 100) : 0;

  return {
    earningsThisMonth: Math.round(earnings * 100) / 100,
    upcomingCount: upcoming.length,
    bookingRate,
  };
}
