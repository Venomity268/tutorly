import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { findBookingById, updateBooking } from "../repositories/bookingRepo.js";
import { createPayment, findPaymentByBookingId } from "../repositories/paymentRepo.js";

export const paymentsRouter = express.Router();

function meetingLinkForBooking(bookingId) {
  return `https://meet.tutorly.app/session/${bookingId}`;
}

paymentsRouter.post("/", requireAuth, requireRole("student"), (req, res) => {
  const { bookingId, method } = req.body ?? {};

  if (!bookingId || typeof bookingId !== "string") {
    return res.status(400).json({ error: "VALIDATION_ERROR", message: "bookingId is required" });
  }

  const booking = findBookingById(bookingId);
  if (!booking || booking.studentId !== req.user.id) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Booking not found" });
  }

  const existing = findPaymentByBookingId(bookingId);
  if (existing && booking.status === "confirmed") {
    return res.json({
      success: true,
      payment: existing,
      booking: { ...booking, meetingLink: booking.meetingLink || meetingLinkForBooking(booking.id) },
      message: "Booking was already confirmed.",
    });
  }

  if (booking.status !== "pending") {
    return res.status(400).json({
      error: "INVALID_STATE",
      message: "Only pending bookings can be paid",
    });
  }

  const methodStr = String(method || "card").toLowerCase();
  const mockFailure = methodStr === "decline" || methodStr === "fail";

  if (mockFailure) {
    return res.status(402).json({
      error: "PAYMENT_FAILED",
      message: "Payment could not be completed. Your booking stays pending.",
      booking,
    });
  }

  const payment = createPayment({ bookingId, method: methodStr });
  const link = meetingLinkForBooking(booking.id);
  const updated = updateBooking(bookingId, { status: "confirmed", meetingLink: link });

  return res.json({
    success: true,
    payment,
    booking: updated,
  });
});
