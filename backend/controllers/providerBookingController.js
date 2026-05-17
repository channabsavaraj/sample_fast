const Booking = require('../models/Booking');
const Provider = require('../models/Provider');

// Get pending booking requests for provider
exports.getPendingBookings = async (req, res) => {
  try {
    const { providerId } = req.params;

    const bookings = await Booking.find({
      bookingStatus: 'waiting_provider',
      paymentStatus: 'paid',
      rejectedProviders: { $nin: [providerId] },
      acceptedProviderId: null
    })
      .populate('userId', 'name email phone')
      .lean();

    res.json({
      success: true,
      bookings: bookings
    });
  } catch (error) {
    console.error('Error fetching pending bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending bookings',
      error: error.message
    });
  }
};

// Provider Accept Booking
exports.acceptBooking = async (req, res) => {
  try {
    const { bookingId, providerId } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.bookingStatus !== 'waiting_provider') {
      return res.status(400).json({
        success: false,
        message: 'Booking is no longer available'
      });
    }

    if (booking.acceptedProviderId && booking.acceptedProviderId.toString() !== providerId) {
      return res.status(400).json({
        success: false,
        message: 'Booking already accepted by another provider'
      });
    }

    // Update booking status
    booking.bookingStatus = 'confirmed';
    booking.acceptedProviderId = providerId;
    booking.providerId = providerId; // legacy field
    booking.status = 'accepted'; // legacy field
    await booking.save();

    res.json({
      success: true,
      message: 'Booking accepted successfully',
      booking: booking
    });
  } catch (error) {
    console.error('Error accepting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept booking',
      error: error.message
    });
  }
};

// Provider Reject Booking
exports.rejectBooking = async (req, res) => {
  try {
    const { bookingId, providerId } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Add to rejected providers list
    if (!booking.rejectedProviders.includes(providerId)) {
      booking.rejectedProviders.push(providerId);
    }

    // Check if all providers have rejected
    const allProviders = await Provider.countDocuments({ verified: true });
    
    if (booking.rejectedProviders.length >= allProviders) {
      booking.bookingStatus = 'rejected';
      booking.status = 'failed';
    }

    await booking.save();

    res.json({
      success: true,
      message: 'Booking rejected',
      booking: booking
    });
  } catch (error) {
    console.error('Error rejecting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject booking',
      error: error.message
    });
  }
};
