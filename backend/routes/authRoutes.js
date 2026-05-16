const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Provider = require("../models/Provider");

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

router.post("/register", async (req,res)=>{
  const {name,email,password,role} = req.body;
  if(await User.findOne({email})) return res.send("User exists");
  const hash = await bcrypt.hash(password,10);
  const user = await User.create({name,email,password:hash,role});
  
  // If role is provider, create provider profile
  if (role === "provider") {
    await Provider.create({ 
      userId: user._id,
      documents: {},
      verified: false 
    });
  }
  
  res.send("Registered");
});

router.post("/login", async (req,res)=>{
  const user = await User.findOne({email:req.body.email});
  if(!user) return res.send("Invalid");
  const ok = await bcrypt.compare(req.body.password,user.password);
  if(!ok) return res.send("Invalid");
  const token = jwt.sign({id:user._id,role:user.role},"SECRET");
  res.json({token,role:user.role});
});

// Get all users (admin only)
router.get("/users", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all providers
router.get("/providers", verifyToken, async (req, res) => {
  try {
    const providers = await Provider.find();
    res.json(providers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify provider (admin only)
router.put("/verify-provider/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const provider = await Provider.findByIdAndUpdate(
      req.params.id, 
      { verified: true }, 
      { new: true }
    );
    res.json(provider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user by ID (admin only)
router.delete("/users/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Also delete associated provider if exists
    await Provider.findOneAndDelete({ userId: req.params.id });
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fix user location - removes invalid location data
router.put("/fix-location/:id", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Set location to null to fix the invalid GeoJSON
    user.location = undefined;
    await user.save();
    res.json({ message: "User location fixed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user location
router.put("/update-location", verifyToken, async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Latitude and longitude are required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        location: {
          type: "Point",
          coordinates: [longitude, latitude],  // GeoJSON format: [longitude, latitude]
          address: address || ""
        },
        lastLocationUpdate: new Date()
      },
      { new: true }
    );

    res.json({
      message: "Location updated successfully",
      location: user.location
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
