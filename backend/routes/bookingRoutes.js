const router = require("express").Router();
const Booking = require("../models/Booking");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

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

router.post("/book", verifyToken, async (req, res) => {
  try {
    const { serviceName, location, coordinates } = req.body;

    const user = await User.findById(req.user.id).lean();

    // MAIN REQUIREMENT: amount is fixed (₹150) but payment will be verified later.
    const booking = await Booking.create({
      userId: req.user.id,
      // providerId is legacy; after payment we will broadcast to all available providers.
      providerId: null,

      serviceName,
      location,
      customerName: user?.name || "",
      customerLocation: location,
      customerContactNumber: user?.phone || "",

      coordinates: coordinates || null,

      amount: 150,
      paymentStatus: "pending",
      bookingStatus: "pending_payment",

      // legacy
      status: "pending",
      providerName: "",
    });

    res.json({ message: "Booking Created", bookingId: booking._id });
  } catch (err) {
    res.status(500).send("Error creating booking");
  }
});



router.post("/status/:id", verifyToken, async (req,res)=>{
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.send("Booking not found");

    // Only provider or admin can update status
    if (req.user.role !== "provider" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const nextStatus = req.body.status;

    // This route is legacy; fixed acceptance/rejection is handled via socket.
    // Keep minimal support for customer cancellation.
    if (nextStatus === "cancelled") {
      await Booking.findByIdAndUpdate(req.params.id, {
        status: "failed",
        paymentStatus: "failed",
        bookingStatus: "rejected",
      });
      return res.send("Updated");
    }

    // ignore accepted/rejected attempts here
    res.send("Ignored (use socket accept/reject)");
  } catch (err) {
    res.status(500).send("Error updating booking");
  }
});


// Get user's bookings
router.get("/my-bookings", verifyToken, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get provider's bookings
router.get("/provider-bookings", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "provider") {
      return res.status(403).json({ error: "Provider access required" });
    }
    const bookings = await Booking.find({ providerId: req.user.id });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all bookings (admin only)
router.get("/", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
