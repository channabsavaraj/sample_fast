const express = require('express');
const router = express.Router();
const razorpayController = require('../controllers/razorpayController');
const providerBookingController = require('../controllers/providerBookingController');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token.split(' ')[1], 'SECRET');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Razorpay payment routes
router.post('/create-order', verifyToken, razorpayController.createOrder);
router.post('/verify-payment', verifyToken, razorpayController.verifyPayment);
router.post('/payment-failure', verifyToken, razorpayController.handlePaymentFailure);
router.get('/booking/:bookingId', verifyToken, razorpayController.getBooking);

// Provider booking routes
router.get('/provider/:providerId/pending-bookings', verifyToken, providerBookingController.getPendingBookings);
router.post('/provider/accept-booking', verifyToken, providerBookingController.acceptBooking);
router.post('/provider/reject-booking', verifyToken, providerBookingController.rejectBooking);

module.exports = router;
