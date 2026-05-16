const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    providerId: mongoose.Schema.Types.ObjectId, // legacy field

    serviceName: String,
    location: String,
    customerName: { type: String, default: "" },
    customerLocation: { type: String, default: "" },
    customerContactNumber: { type: String, default: "" },

    coordinates: {
      lat: Number,
      lng: Number,
    },

    // Fixed amount requirement
    amount: { type: Number, default: 150 },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },

    bookingStatus: {
      type: String,
      enum: [
        "pending_payment",
        "waiting_provider",
        "confirmed",
        "rejected",
      ],
      default: "pending_payment",
    },

    // One-provider acceptance enforcement
    acceptedProviderId: { type: mongoose.Schema.Types.ObjectId, default: null },
    rejectedProviders: [{ type: mongoose.Schema.Types.ObjectId, default: [] }],

    // legacy status fields used by existing UI/routes
    status: { type: String, default: "pending" },
    providerName: { type: String, default: "" },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

module.exports = mongoose.model("Booking", BookingSchema);

