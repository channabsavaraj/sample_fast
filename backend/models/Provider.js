const mongoose = require("mongoose");

module.exports = mongoose.model("Provider", new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  documents: {
    aadhar: String,
    pan: String,
    voter: String
  },
  verified: { type: Boolean, default: false }
}));
