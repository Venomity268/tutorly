import bcrypt from "bcryptjs";
import { createUser, findUserByEmail } from "./repositories/userRepo.js";
import { createTutor, findTutorByUserId, updateTutorVerification } from "./repositories/tutorRepo.js";

export async function seed() {
  // Keep seed minimal: only four sign-in accounts, no demo sessions/slots/bookings.
  const accounts = [
    { fullName: "Admin User", email: "admin@tutorly.com", password: "admin123", role: "admin" },
    { fullName: "Dionte", email: "dionte@tutorly.com", password: "tutor123", role: "tutor" },
    { fullName: "Maldrick", email: "maldrick@tutorly.com", password: "tutor123", role: "tutor" },
    { fullName: "Esther", email: "esther@tutorly.com", password: "tutor123", role: "tutor" },
  ];

  for (const account of accounts) {
    let user = findUserByEmail(account.email);
    if (!user) {
      try {
        user = createUser({
          fullName: account.fullName,
          email: account.email,
          passwordHash: await bcrypt.hash(account.password, 10),
          role: account.role,
        });
      } catch {
        continue;
      }
    }
    if (account.role === "tutor") {
      let tutor = findTutorByUserId(user.id);
      if (!tutor) {
        try {
          tutor = createTutor({
            userId: user.id,
            bio: "",
            hourlyRate: 0,
            subjects: [],
            yearsExperience: 0,
          });
        } catch {
          continue;
        }
      }
      if (tutor.verificationStatus !== "approved") {
        updateTutorVerification(tutor.id, "approved");
      }
    }
  }
}
