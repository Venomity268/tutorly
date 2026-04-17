import crypto from "crypto";

/**
 * MVP note: This is an in-memory repository to unblock the happy path quickly.
 * Swap with a real DB/ORM (e.g. Prisma) without changing route handlers.
 */

const usersById = new Map();
const usersByEmail = new Map();

export function createUser({
  fullName,
  email,
  passwordHash,
  role,
  studentSubjects = [],
  studentLevel = "",
}) {
  const normalizedEmail = email.trim().toLowerCase();
  if (usersByEmail.has(normalizedEmail)) {
    const err = new Error("Email already in use");
    err.code = "EMAIL_IN_USE";
    throw err;
  }

  const subs = Array.isArray(studentSubjects) ? studentSubjects : [];

  const user = {
    id: crypto.randomUUID(),
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    status: "active",
    studentSubjects: subs,
    studentLevel: String(studentLevel || "").trim(),
    createdAt: new Date().toISOString(),
  };

  usersById.set(user.id, user);
  usersByEmail.set(user.email, user);
  return { ...user };
}

function withUserDefaults(u) {
  if (!u) return null;
  return {
    ...u,
    studentSubjects: u.studentSubjects ?? [],
    studentLevel: u.studentLevel ?? "",
  };
}

export function findUserByEmail(email) {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const user = usersByEmail.get(normalizedEmail);
  return withUserDefaults(user);
}

export function findUserById(id) {
  if (!id) return null;
  const user = usersById.get(id);
  return withUserDefaults(user);
}

export function listUsers() {
  return Array.from(usersById.values()).map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
  }));
}

export function updatePassword(userId, passwordHash) {
  const user = usersById.get(userId);
  if (!user) return null;
  user.passwordHash = passwordHash;
  return { ...user };
}

export function updateUser(userId, updates) {
  const user = usersById.get(userId);
  if (!user) return null;
  if (updates.fullName !== undefined) user.fullName = String(updates.fullName || "").trim();
  if (updates.studentSubjects !== undefined) {
    user.studentSubjects = Array.isArray(updates.studentSubjects) ? [...updates.studentSubjects] : [];
  }
  if (updates.studentLevel !== undefined) {
    user.studentLevel = String(updates.studentLevel || "").trim();
  }
  return { ...user };
}

