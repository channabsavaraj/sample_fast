const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["user", "provider", "admin"] },
  location: {
    type: {
      type: String,
      enum: ["Point"]
    },
    coordinates: {
      type: [Number]  // [longitude, latitude]
    },
    address: {
      type: String
    }
  },
  lastLocationUpdate: {
    type: Date,
    default: null
  }
});

// Create 2dsphere index for geospatial queries
userSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("User", userSchema);
