import crypto from "crypto";

/**
 * MVP note: This is an in-memory repository to unblock the happy path quickly.
 * Swap with a real DB/ORM (e.g. Prisma) without changing route handlers.
 */

const usersById = new Map();
const usersByEmail = new Map();

export function createUser({ fullName, email, passwordHash, role }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (usersByEmail.has(normalizedEmail)) {
    const err = new Error("Email already in use");
    err.code = "EMAIL_IN_USE";
    throw err;
  }

  const user = {
    id: crypto.randomUUID(),
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash,
    role,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  usersById.set(user.id, user);
  usersByEmail.set(user.email, user);
  return { ...user };
}

export function findUserByEmail(email) {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const user = usersByEmail.get(normalizedEmail);
  return user ? { ...user } : null;
}

export function findUserById(id) {
  if (!id) return null;
  const user = usersById.get(id);
  return user ? { ...user } : null;
}

