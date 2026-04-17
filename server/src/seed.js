import bcrypt from "bcryptjs";
import { createUser, findUserByEmail } from "./repositories/userRepo.js";
import { createTutor, findTutorByUserId, updateTutorVerification } from "./repositories/tutorRepo.js";
import { createCourse } from "./repositories/courseRepo.js";
import { createBooking } from "./repositories/bookingRepo.js";
import { createSlot, listSlotsByTutorId } from "./repositories/slotRepo.js";

function seedWeeklySlots(tutorId) {
  if (listSlotsByTutorId(tutorId).length > 0) return;
  const now = new Date();
  for (let d = 0; d < 14; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    for (const hour of [9, 11, 13, 15, 17]) {
      const t = new Date(day);
      t.setHours(hour, 0, 0, 0);
      if (t <= now) continue;
      try {
        createSlot({ tutorId, startAt: t.toISOString(), durationMinutes: 60 });
      } catch {
        /* ignore */
      }
    }
  }
}

export async function seed() {
  // Admin
  if (!findUserByEmail("admin@tutorly.com")) {
    createUser({
      fullName: "Admin User",
      email: "admin@tutorly.com",
      passwordHash: await bcrypt.hash("admin123", 10),
      role: "admin",
    });
  }

  // Courses
  const courses = [
    { name: "Mathematics", slug: "mathematics", description: "Algebra, calculus, statistics" },
    { name: "Physics", slug: "physics", description: "Mechanics, thermodynamics, quantum" },
    { name: "Chemistry", slug: "chemistry", description: "Organic, inorganic, analytical" },
    { name: "English", slug: "english", description: "Literature, writing, grammar" },
    { name: "Computer Science", slug: "computer-science", description: "Programming, algorithms" },
    { name: "Biology", slug: "biology", description: "Cell biology, genetics, ecology" },
  ];
  for (const c of courses) {
    try {
      createCourse(c);
    } catch {
      /* exists */
    }
  }

  // Demo student (for booking / payments flow)
  if (!findUserByEmail("student@tutorly.com")) {
    createUser({
      fullName: "Alex Student",
      email: "student@tutorly.com",
      passwordHash: await bcrypt.hash("student123", 10),
      role: "student",
    });
  }

  // Sample tutors
  const tutors = [
    { fullName: "Dionte", email: "dionte@tutorly.com", bio: "PhD Physics. University lecturer.", hourlyRate: 45, subjects: ["physics", "mathematics"], years: 8, status: "approved" },
    { fullName: "Maldrick", email: "maldrick@tutorly.com", bio: "MSc Physics. High school specialist.", hourlyRate: 35, subjects: ["physics"], years: 5, status: "approved" },
    { fullName: "Esther", email: "esther@tutorly.com", bio: "Math tutor. Patient and clear.", hourlyRate: 40, subjects: ["mathematics"], years: 6, status: "pending" },
  ];

  for (const t of tutors) {
    let user = findUserByEmail(t.email);
    if (!user) {
      try {
        user = createUser({
          fullName: t.fullName,
          email: t.email,
          passwordHash: await bcrypt.hash("tutor123", 10),
          role: "tutor",
        });
      } catch {
        continue;
      }
    }
    let tutor = findTutorByUserId(user.id);
    if (!tutor) {
      try {
        tutor = createTutor({
          userId: user.id,
          bio: t.bio,
          hourlyRate: t.hourlyRate,
          subjects: t.subjects,
          yearsExperience: t.years,
        });
      } catch {
        continue;
      }
    }
    if (t.status === "approved" && tutor.verificationStatus !== "approved") {
      updateTutorVerification(tutor.id, "approved");
    }

    if (t.status === "approved" && (t.email === "dionte@tutorly.com" || t.email === "maldrick@tutorly.com")) {
      seedWeeklySlots(tutor.id);
    }

    // Seed sample bookings for approved tutors
    if (t.status === "approved" && t.email === "dionte@tutorly.com") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const base = new Date(tomorrow);
      base.setHours(14, 0, 0, 0);
      createBooking({ tutorId: tutor.id, studentId: "s1", studentName: "Alex Johnson", subject: "Physics • Quantum Mechanics", startAt: base, durationMinutes: 60, status: "confirmed" });
      base.setHours(17, 30, 0, 0);
      createBooking({ tutorId: tutor.id, studentId: "s2", studentName: "Maria Garcia", subject: "Physics • Thermodynamics", startAt: base, durationMinutes: 60, status: "pending" });
      base.setHours(19, 0, 0, 0);
      createBooking({ tutorId: tutor.id, studentId: "s3", studentName: "David Kim", subject: "Physics • Exam Prep", startAt: base, durationMinutes: 60, status: "confirmed" });
      const thisMonth = new Date();
      thisMonth.setDate(5);
      thisMonth.setHours(15, 0, 0, 0);
      createBooking({ tutorId: tutor.id, studentId: "s5", studentName: "Prior Student", subject: "Physics", startAt: thisMonth, durationMinutes: 60, status: "completed" });
      createBooking({ tutorId: tutor.id, studentId: "s6", studentName: "Another Student", subject: "Mathematics", startAt: new Date(thisMonth.getTime() + 86400000 * 2), durationMinutes: 90, status: "completed" });
    }
    if (t.status === "approved" && t.email === "maldrick@tutorly.com") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const base = new Date(tomorrow);
      base.setHours(10, 0, 0, 0);
      createBooking({ tutorId: tutor.id, studentId: "s4", studentName: "Sam Wilson", subject: "Physics", startAt: base, durationMinutes: 45, status: "confirmed" });
    }
  }
}
