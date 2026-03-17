import { findUserById } from "../repositories/userRepo.js";
import { verifyAccessToken } from "../utils/jwt.js";

function parseBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function requireAuth(req, res, next) {
  try {
    const token = parseBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Missing bearer token" });
    }

    const payload = verifyAccessToken(token);
    const user = findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid token subject" });
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };

    return next();
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or expired token" });
  }
}

export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return function roleGuard(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Not authenticated" });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Insufficient role" });
    }
    return next();
  };
}

