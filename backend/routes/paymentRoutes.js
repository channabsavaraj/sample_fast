const router = require("express").Router();
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token.split(" ")[1], "SECRET");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Simulated payment verification endpoint.
// IMPORTANT: Replace this with your real payment gateway verification/webhook later.
// Body can include { outcome: "paid" | "failed" } to control result.
router.post("/verify/:bookingId", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Only the user who created the booking can verify status
    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const outcome = req.body?.outcome;
    const shouldSucceed = outcome === "failed" ? false : true;

    // MAIN REQUIREMENT: Amount is fixed ₹150
    booking.amount = 150;

    booking.paymentStatus = shouldSucceed ? "paid" : "failed";

    // required logic:
    // - if payment successful: waiting_provider (NOT confirmed yet)
    // - only after provider accept -> confirmed
    booking.bookingStatus = shouldSucceed ? "waiting_provider" : "failed";

    // legacy sync
    booking.status = shouldSucceed ? "pending" : "failed";

    // fill customer details for provider card (best-effort)
    const User = require("../models/User");
    const user = await User.findById(booking.userId).lean();

    booking.customerName = user?.name || booking.customerName || "";
    booking.customerLocation = booking.customerLocation || booking.location || "";
    booking.customerContactNumber = user?.phone || user?.contactNumber || booking.customerContactNumber || "";

    // ensure fixed amount stored
    booking.amount = 150;

    await booking.save();

    // real-time: send provider request to ALL available providers (after payment successful)
    if (shouldSucceed) {
      try {
        const Provider = require("../models/Provider");
        const providers = await Provider.find({ verified: true }).lean();

        const { emitToProvider } = require("../utils/socketEmitters");
        const socketHandler = require("../socket/socketHandler");

        const payloadBase = {
          bookingId: booking._id,
          serviceName: booking.serviceName,
          userId: booking.userId,
          userName: booking.customerName,
          userLocation: booking.customerLocation || booking.location,
          customerContactNumber: booking.customerContactNumber,
          location: booking.location,
          amount: booking.amount,
          paymentStatus: booking.paymentStatus,
          bookingStatus: booking.bookingStatus,
          createdAt: booking.createdAt,
        };

        for (const p of providers) {
          const providerId = String(p._id);
          const providerSocketId = socketHandler._providers?.[providerId];
          if (!providerSocketId) continue;

          emitToProvider(providerSocketId, "new-booking", {
            ...payloadBase,
            providerId: p._id,
          });
        }
      } catch (e) {
        // Non-blocking: payment success should still respond
        console.warn("Failed to emit provider booking request:", e?.message || e);
      }
    }


    return res.json({
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus,
      bookingId: booking._id,
    });
  } catch (err) {
    return res.status(500).json({ error: "Payment verification failed" });
  }
});


router.get("/status/:bookingId", verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    return res.json({
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.bookingStatus
    });
  } catch (err) {
    return res.status(500).json({ error: "Unable to fetch payment status" });
  }
});

module.exports = router;

