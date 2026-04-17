import crypto from "crypto";

const paymentsById = new Map();
const paymentsByBookingId = new Map();

export function createPayment({ bookingId, method, status = "completed", amount }) {
  const p = {
    id: crypto.randomUUID(),
    bookingId,
    method: String(method || "mock"),
    status,
    amount: amount ?? null,
    createdAt: new Date().toISOString(),
  };
  paymentsById.set(p.id, p);
  paymentsByBookingId.set(bookingId, p);
  return { ...p };
}

export function findPaymentByBookingId(bookingId) {
  const p = paymentsByBookingId.get(bookingId);
  return p ? { ...p } : null;
}
